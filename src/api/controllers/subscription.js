const stripe = require("stripe")(process.env.STRIPE_SECRET);
const subscription = require("../models/subscription.model");
const User = require("../models/user.model");
const Product = require("../models/products.model");
const StripeProduct = require("../models/stripeProducts.model");
const mongoose = require("mongoose");
const moment = require("moment");
const { isNumber } = require("lodash");
const StripeProducts = require("../models/stripeProducts.model");
const emailProvider = require("../services/emails/emailProvider");
const Subscription = require("../models/subscription.model");
const sgMail = require("@sendgrid/mail");
const { emailConfig } = require("../../config/vars");

sgMail.setApiKey(emailConfig.sendGridApi);

//Retrieve an upcoming invoice
// const invoice = await stripe.invoices.retrieveUpcoming({
//   customer: "cus_9s6XKzkNRiz8i3",
// });

// util.js

function centsToDollar(cents) {
  return cents / 100;
}

function getHumanReadableDate(timestamp) {
  // Convert the timestamp to a Date object

  if (isNumber(timestamp)) {
    const dateObject = new Date(timestamp * 1000);

    // Extract the day, month, and year from the date object
    const day = dateObject.getDate();
    const month = dateObject.getMonth() + 1; // Months are 0-based, so we add 1
    const year = dateObject.getFullYear();

    // Format the date as a string in the desired format (e.g., "28/08/2023")
    const formattedDate = `${day.toString().padStart(2, "0")}/${month
      .toString()
      .padStart(2, "0")}/${year}`;

    return formattedDate;
  } else {
    // If the timestamp is in ISO 8601 format, convert it to a moment object
    return moment(timestamp).format("DD/MM/YYYY");
  }
}

// Example usage:

const planToProductMap = {
  STARTER: "prod_OKieGxqxMLmcJc",
  LITE: "prod_OKiTjVnsek08K0",
  BUSINESS: "prod_OKiY85SvaDr9dk",
  PROFESSIONAL: "prod_PrT2BmO6Jck99w",
};

module.exports.createSubscriptionPlan = async (req, res) => {
  const userId = req.user._id;
  const userEmail = req.user.email;
  const userName = req.user.firstName;
  const selectedPlan = req.body.selectedPlan; // Assuming the selected plan will be one of the plan variables (e.g., LITE, PRO, PREMIUM)
  const annualPurchase = req.body.annualPurchase;
  const fromHomePage = req.body.fromHomePage;
  const couponCode = req.body.couponCode;

  try {
    const user = await User.findById(mongoose.Types.ObjectId(userId));
    let customerId;
    if (!user) {
      return res.status(400).json({ status: 404, data: "user not found" });
    }

    if (!user?.stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        name: userName,
        metadata: { userId: userId.toString() },
      });
      await User.findByIdAndUpdate(user._id, {
        stripeCustomerId: customer.id,
      });
      customerId = customer.id;
    } else {
      customerId = user.stripeCustomerId;
    }

    const stripeProductId = planToProductMap[selectedPlan];
    const prices = await stripe.prices.list({ product: stripeProductId });

    // Find the price object for the annual plan and monthly plan
    const annualPlan = prices.data.find(
      (price) => price.recurring.interval === "year"
    );
    const monthlyPlan = prices.data.find(
      (price) => price.recurring.interval === "month"
    );

    const selectedPriceId = annualPurchase ? annualPlan.id : monthlyPlan.id;
    const price = annualPurchase
      ? annualPlan.unit_amount
      : monthlyPlan.unit_amount;

    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    const queryParams = new URLSearchParams({
      token: token,
      email: user.email,
      userId: user.id,
      role: user.role,
    });

    const existingPendingSubscription = await subscription.findOne({
      stripeCustomerId: customerId,
      paymentStatus: "PENDING",
    });

    const session = await stripe.checkout.sessions.create({
      metadata: { userId: userId.toString(), couponCode: couponCode },
      line_items: [{ price: selectedPriceId, quantity: 1 }],
      discounts: couponCode ? [{ coupon: couponCode }] : [],
      mode: "subscription",
      billing_address_collection: "required",
      payment_method_collection: "always",
      success_url: fromHomePage
        ? process.env.SUCCESS_URL + "?" + queryParams
        : process.env.SUCCESS_URL,
      cancel_url: process.env.FAILURE_URL,
      customer: customerId,
    });

    const subscriptionData = {
      userId: userId,
      amount: price,
      paymentStatus: "PENDING",
      isAnnual: annualPurchase,
      stripePriceId: selectedPriceId,
      planName: selectedPlan, // Set the planName field here
      stripeCustomerId: session.customer,
      sessionId: session.id,
    };

    if (!existingPendingSubscription) {
      const newSubscription = new subscription(subscriptionData);
      await newSubscription.save();
    } else if (existingPendingSubscription) {
      await subscription.findOneAndUpdate(
        {
          _id: existingPendingSubscription._id,
        },
        subscriptionData
      );
    }

    return res.status(200).json({
      status: 200,
      data: session.url,
    });
  } catch (e) {
    console.log("ERROR:", e);
    return res.status(400).json({ status: 400, data: e.message });
  }
};

module.exports.changeSubscriptionPlan = async (req, res) => {
  try {
    const userId = req.user._id;

    const { selectedPlan, annualPurchase, couponCode } = req.body;

    const stripeProductId = planToProductMap[selectedPlan];
    const prices = await stripe.prices.list({ product: stripeProductId });
    const currentUserSubscription = await subscription.findOne({
      userId,
      stripeSubscriptionPaid: true,
      stripeSubscriptionStatus: "active",
      paymentStatus: { $eq: "SUCCESS" },
    });

    if (!currentUserSubscription) {
      return res.status(404).json({
        message: "No Current Subscription is found.",
      });
    }

    if (
      currentUserSubscription?.planName === selectedPlan &&
      currentUserSubscription?.annualPurchase === annualPurchase
    ) {
      throw new Error("Cannot upgrade to the same plan!");
    }

    const annualPlan = prices.data.find(
      (price) => price.recurring.interval === "year"
    );
    const monthlyPlan = prices.data.find(
      (price) => price.recurring.interval === "month"
    );

    const selectedPriceId = annualPurchase ? annualPlan.id : monthlyPlan.id;

    const proration_date = Math.floor(Date.now() / 1000);
    const current_stripe_subscription = await stripe.subscriptions.retrieve(
      currentUserSubscription?.subscriptionId
    );

    if (!current_stripe_subscription) {
      return res.status(404).json({
        message: "No Current Subscription is found.",
      });
    }

    stripe.subscriptions.update(currentUserSubscription?.subscriptionId, {
      items: [
        {
          id: current_stripe_subscription.items.data[0].id,
          price: selectedPriceId,
        },
      ],
      ...(couponCode ? { couponCode: couponCode } : {}),
      proration_date: proration_date,
      cancel_at_period_end: false,
      proration_behavior: "always_invoice",
      metadata: { userId: userId.toString(), couponCode: couponCode },
    });

    const price = annualPurchase
      ? annualPlan.unit_amount
      : monthlyPlan.unit_amount;
    await subscription.findByIdAndUpdate(currentUserSubscription._id, {
      planName: selectedPlan,
      stripePriceId: selectedPriceId,
      appliedToCancel: false,
      annualPurchase: annualPurchase,
      amount: price,
    });

    return res.status(200).json({
      status: 200,
      data: process.env.SUCCESS_URL,
    });
  } catch (e) {
    return res.status(400).json({ status: 400, msg: e.message, data: {} });
  }
};

module.exports.cancelSubscribedPlan = async (req, res) => {
  try {
    const { subscriptionId } = req.body;
    const existingSubscription = await subscription.findOne({
      _id: subscriptionId,
    });
    if (!existingSubscription) {
      return res.status(404).json({ error: "Plan not found." });
    }

    const stripeSubscription = await stripe.subscriptions.retrieve(
      existingSubscription.subscriptionId
    );
    if (
      stripeSubscription.status === "canceled" ||
      existingSubscription.appliedToCancel
    ) {
      return res
        .status(400)
        .json({ message: "Subscription is already canceled." });
    }

    existingSubscription.appliedToCancel = true;
    await existingSubscription.save();

    const updatedStripeSubscription = await stripe.subscriptions.update(
      existingSubscription.subscriptionId,
      {
        cancel_at_period_end: true,
      }
    );

    const user = await User.findOne({
      _id: existingSubscription?.userId,
    });

    const html = (fullname) => {
      return `
    <p>Hi ${fullname},</p>
    <p>We appreciate your interest in the Q1box. Your cancellation request has been processed successfully, and no further charges will occur</p>
    <p>Feel free to return anytime if you decide to subscribe again. We're here to support you, whatever you choose!</p>
    <p>We value your feedback. Please share your experience and suggestions on how we can enhance our services for you and our customers in the future..</p>
    <p>Thank you for your ongoing support!</p>
    <p>Best regards,</p>
    <p>Q1box</p>
    `;
    };
    const msg = {
      to: user?.email,
      from: "support@q1box.com.au", // Replace with your email address
      subject: "Your Q1box Subscription Cancellation Confirmation",
      html: html(`${user.firstName} ${user.lastName}`),
    };

    await sgMail.send(msg);

    return res.json({
      message: "Subscription cancellation applied successfully.",
      appliedToCancel: true,
      cancellationDate: getHumanReadableDate(
        updatedStripeSubscription.cancel_at
      ),
    });
  } catch (error) {
    return res.status(500).json({
      message: "An error occurred while processing the cancellation.",
    });
  }
};

module.exports.getSubscribedPlan = async (req, res) => {
  try {
    const userId = req.user._id;
    let isTrail = false;
    let current_period_start;
    let current_period_end;
    const existingPlan = await subscription.findOne({
      userId: userId,
      paymentStatus: { $ne: "FAIL" },
      subscriptionDeleted: { $ne: true },
    });
    if (existingPlan) {
      const stripeSubscription = await stripe.subscriptions.retrieve(
        existingPlan?.subscriptionId
      );
      if (stripeSubscription?.status === "trialing") {
        isTrail = true;
        current_period_start = stripeSubscription.current_period_start * 1000;
        current_period_end = stripeSubscription.current_period_end * 1000;
      }
    }
    return res.status(200).json({
      status: 200,
      data: existingPlan ? existingPlan : {},
      isTrail: isTrail,
      current_period_start: current_period_start,
      current_period_end: current_period_end,
      msg: existingPlan ? "Data Found" : "No Data Found",
    });
  } catch (e) {
    console.log("ERROR:", e);
    return res.status(400).json({ status: 400, data: e.message });
  }
};

module.exports.getCustomerInvoices = async (req, res) => {
  try {
    const userId = req.params.userId;
    const user = await User.findOne({ _id: userId });
    const stripeCustomerId = user?.stripeCustomerId;
    const currentSubscription = await subscription.findOne({
      stripeCustomerId: stripeCustomerId,
      paymentStatus: "SUCCESS",
      stripeSubscriptionPaid: true,
      stripeSubscriptionStatus: "active",
    });

    let current_subscription = "";

    let nextInvoice = null;
    let refactorInvoices = [];
    if (stripeCustomerId) {
      const invoices = await stripe.invoices.list({
        customer: stripeCustomerId,
      });

      try {
        nextInvoice = await stripe.invoices.retrieveUpcoming({
          customer: stripeCustomerId,
        });
      } catch (error) {
        console.error(
          "Error while retrieving upcoming invoice:",
          error.message
        );
      }

      refactorInvoices = invoices?.data?.map((i) => {
        return {
          date: getHumanReadableDate(i.created), // Convert timestamp to human-readable date
          status: i.status,
          amount: {
            amount_paid: i.amount_paid,
            amount_remaining: i.amount_remaining,
          },
          address: i.customer_address,
          invoices: i.hosted_invoice_url,
        };
      });
    }

    const isTrialValid = user?.trialExpirationDate
      ? new Date() <= user.trialExpirationDate
      : null;

    // Add the "Free" plan to the response if the trial is valid
    const plan =
      isTrialValid && !currentSubscription?.planName
        ? "Free"
        : currentSubscription?.planName;

    if (currentSubscription?.subscriptionId) {
      current_subscription = await stripe.subscriptions.retrieve(
        currentSubscription?.subscriptionId
      );
    }

    return res.status(200).json({
      status: 200,
      data: {
        invoices: refactorInvoices || [],
        nextInvoice: nextInvoice
          ? {
              starting_date:
                getHumanReadableDate(nextInvoice?.next_payment_attempt) || "",
              amount: nextInvoice?.total || 0,
            }
          : null,
        customerCard: currentSubscription?.cardDetails || {},
        customerBillingInfo: currentSubscription?.customerDetails || {},
        paymentStatus: currentSubscription?.paymentStatus === "SUCCESS",
        plan: plan,
        amount: centsToDollar(currentSubscription?.amount),
        appliedToCancel: current_subscription?.cancel_at_period_end,
        stripeSubscriptionStatus: currentSubscription?.stripeSubscriptionStatus,
        sub_id: currentSubscription?._id,
        trialExpirationDate:
          getHumanReadableDate(user?.trialExpirationDate) || null,
        isTrialValid: isTrialValid,
        user: {
          name: user?.firstName + " " + user?.lastName,
          email: user?.email,
          country: user?.country,
          city: user?.city,
        },
      },
    });
  } catch (e) {
    return res.status(400).json({ status: 400, data: e.message });
  }
};

module.exports.subscriptionInfo = async (req, res) => {
  try {
    const currentUser = req?.user;
    if (!currentUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    let trialValid = false;
    let isValid = false;
    let hadSubscribed = false;
    let planName = "";
    let currentSubscriptionValid = false;
    let totalTeamCount = 0;
    let annualPurchase = false;
    let canAddMoreUser = true;
    if (currentUser.createdBy) {
      const createdByUser = await User.findOne({ _id: currentUser.createdBy });
      if (createdByUser) {
        trialValid = createdByUser.trialExpirationDate
          ? new Date() <= createdByUser.trialExpirationDate
          : false;

        const currentSubscription = await this.currentSubscription(
          currentUser.id
        );

        if (currentSubscription) {
          isValid = currentSubscription.paymentStatus === "SUCCESS";
          hadSubscribed = currentSubscription.hadSubscribed;
          planName = currentSubscription.planName || "";
          currentSubscriptionValid =
            currentSubscription.paymentStatus === "SUCCESS";
        }
      }
      canAddMoreUser = false;
    } else {
      const currentSubscription = await this.currentSubscription(
        currentUser.id
      );

      totalTeamCount = await User.countDocuments({
        createdBy: currentUser.id,
      });

      trialValid = currentUser.trialExpirationDate
        ? new Date() <= currentUser.trialExpirationDate
        : false;

      if (currentSubscription) {
        planName = currentSubscription.planName || "";

        isValid =
          currentSubscription.paymentStatus === "SUCCESS" &&
          (currentSubscription.stripeSubscriptionStatus === "active" ||
            currentSubscription.stripeSubscriptionStatus === "paid");

        hadSubscribed = currentSubscription.hadSubscribed;
        currentSubscriptionValid =
          currentSubscription.paymentStatus === "SUCCESS" &&
          (currentSubscription.stripeSubscriptionStatus === "active" ||
            currentSubscription.stripeSubscriptionStatus === "paid");

        annualPurchase = currentSubscription.annualPurchase;

        if (
          (totalTeamCount === 1 && planName === "BUSINESS") ||
          (totalTeamCount === 4 && planName === "PROFESSIONAL")
        ) {
          canAddMoreUser = false;
        }
        if (planName === "LITE" || planName === "STARTER") {
          canAddMoreUser = false;
        }
      } else if (!currentSubscription) {
        canAddMoreUser = false;
      }
    }
    isValid = trialValid || isValid;

    return res.status(200).json({
      trialValid: trialValid,
      isValid: isValid,
      hadSubscribed: hadSubscribed,
      planName: planName || "Free",
      currentSubscriptionValid: currentSubscriptionValid,
      totalTeamCount: totalTeamCount,
      canAddMoreUser: canAddMoreUser,
      isAnnual: annualPurchase,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getAllSubscriptionDetails = async (req, res, next) => {
  try {
    const plan = req.query.planName || "";
    const status = req.query.status;
    let query = {}; // Initialize an empty query object

    if (plan.length > 0) {
      query.planName = plan; // Add planName condition to the query if available
    }

    if (status) {
      query.subscriptionPausedByAdmin = status === "ACTIVE" ? false : true;
    }

    const subscriptionDetailsList = [];
    const subscriptions = await subscription.find(query);

    const promises = subscriptions.map(async (sub) => {
      try {
        // Fetch user details from your User model using userId from the subscription
        const user = await User.findById(sub.userId);

        if (!user) {
          console.warn(
            `User not found for subscriptionId: ${sub.subscriptionId}`
          );
          return; // Skip this iteration and move to the next subscription
        }

        let upcomingInvoice = {};
        if (sub?.subscriptionId) {
          try {
            upcomingInvoice =
              (await stripe.invoices.retrieveUpcoming({
                customer: user?.stripeCustomerId,
              })) || {};

            // Check if there is no upcoming invoice
            if (!upcomingInvoice) {
              console.warn(
                `No upcoming invoice found for subscriptionId: ${sub.subscriptionId}`
              );
              return; // Skip this iteration and move to the next subscription
            }
          } catch (err) {
            console.warn(err);
          }

          // Retrieve subscription information from Stripe using the subscription ID
          const stripeSubscription = await stripe.subscriptions.retrieve(
            sub?.subscriptionId
          );

          const subscriptionDetails = {
            userId: user.id,
            userName: `${user.firstName} ${user.lastName}`,
            startDate:
              moment(stripeSubscription.current_period_start * 1000).format(
                "MM/DD/YYYY"
              ) || "",
            endDate:
              moment(stripeSubscription.current_period_end * 1000).format(
                "MM/DD/YYYY"
              ) || "",
            amount: centsToDollar(stripeSubscription.plan.amount),
            pauseCollection:
              stripeSubscription?.pause_collection?.behavior || "",
            planName: subscriptions?.planName,
            status: stripeSubscription.status,
            subscription: sub.subscriptionId,
            upcomingInvoiceDate:
              moment(upcomingInvoice.effective_at * 1000).format(
                "MM/DD/YYYY"
              ) || "",
            upcomingInvoiceAmount:
              centsToDollar(upcomingInvoice.amount_due) || "",
            // Add other subscription-related fields from your models and Stripe
          };

          subscriptionDetailsList.push(subscriptionDetails);
        }
      } catch (error) {
        console.error("Error in fetching subscription details:", error);
        // Handle the error if needed
      }
    });

    await Promise.all(promises);

    const offset = parseInt(req.query.offset) || 0;
    const limit = parseInt(req.query.limit) || 10;

    const totalRecords = subscriptionDetailsList.length;
    const totalPages = Math.ceil(totalRecords / limit);

    const startIndex = offset;
    const endIndex = startIndex + limit;

    const paginatedSubscriptions = subscriptionDetailsList.slice(
      startIndex,
      endIndex
    );

    res.status(200).json({
      subscriptions: paginatedSubscriptions,
      currentPage: Math.floor(offset / limit) + 1,
      totalPages,
      totalRecords,
      hasNextPage: (offset + 1) * limit < totalRecords,
    });
  } catch (error) {
    console.error("Error in fetching subscription details:", error);
    return res.status(500).json(error);
  }
};

exports.getSubscriptionById = async (req, res, next) => {
  try {
    const sub_id = req.params.id;
    const stripe_subscription = await stripe.subscriptions.retrieve(sub_id);

    if (!stripe_subscription) {
      return res
        .status(500)
        .json("No Subscription found against Your subscription id");
    }
    const subscription_info = await subscription.findOne({
      subscriptionId: sub_id,
    });
    if (!subscription_info) {
      return res
        .status(500)
        .json("No Subscription info found against Your subscription id");
    }
    const user = await User.findOne({ _id: subscription_info.userId });

    // const subscriptionInvoice = await stripe.invoices.retrieve(
    //   stripe_subscription.latest_invoice
    // );

    const subscriptionInvoice = await stripe.invoices.list({
      subscription: subscription_info.subscriptionId,
    });

    const invoiceData = subscriptionInvoice.data.map((subInvoice) => {
      return {
        invoice: subInvoice.hosted_invoice_url,
        status: subInvoice.paid,
        planName: subscription_info.planName,
        amount: centsToDollar(subInvoice.amount_due),
        startDate: new Date(
          subInvoice.period_start * 1000
        ).toLocaleDateString(),
        endDate: new Date(subInvoice.period_end * 1000).toLocaleDateString(),
        paidAt: subInvoice.status_transitions.paid_at
          ? new Date(
              subInvoice.status_transitions.paid_at * 1000
            ).toLocaleDateString()
          : "---",
      };
    });
    const startDate = new Date(
      stripe_subscription?.current_period_start * 1000
    );
    const endDate = new Date(stripe_subscription?.current_period_end * 1000);

    const monthDiff =
      (endDate?.getFullYear() - startDate?.getFullYear()) * 12 +
      (endDate?.getMonth() - startDate?.getMonth());

    const info = {
      user: user?.firstName + " " + user?.lastName,
      email: user?.email,
      planName: subscription_info.planName,
      amount: centsToDollar(stripe_subscription.plan.amount),
      startDate: moment(startDate, "MM/DD/YYYY").format("MM/DD/YYYY"),
      endDate: moment(endDate, "MM/DD/YYYY").format("MM/DD/YYYY"),
      id: sub_id,
      status: stripe_subscription.status === "active",
      months: monthDiff,
      picture: user?.picture || "",
      invoices: invoiceData || [],
    };
    return res.status(200).json(info);
  } catch (error) {
    return res.status(500).json(error);
  }
};

exports.pauseResumeSubscription = async (req, res) => {
  try {
    const id = req.body.id;
    const type = req.body.type;
    const userId = req.body.userId;
    if (!id || (type !== "PAUSE" && type !== "RESUME")) {
      return res.status(400).json({ message: "Invalid request." });
    }

    // Check if the subscription exists
    const subscription = await stripe.subscriptions.retrieve(id);

    if (!subscription) {
      return res.status(404).json({ message: "Subscription not found." });
    }

    // Update the subscription based on the type
    if (type === "PAUSE") {
      await Subscription.updateOne(
        { subscriptionId: id },
        { subscriptionPausedByAdmin: true }
      );
      await stripe.subscriptions.update(id, {
        pause_collection: {
          behavior: "void",
        },
      });

      return res
        .status(200)
        .json({ message: "Subscription paused successfully." });
    } else if (type === "RESUME") {
      await Subscription.updateOne(
        { subscriptionId: id },
        { subscriptionPausedByAdmin: false }
      );
      await stripe.subscriptions.update(id, {
        pause_collection: null, // Set to null to resume
      });
      return res
        .status(200)
        .json({ message: "Subscription resumed successfully." });
    }
  } catch (err) {
    console.error("Error:", err);
    return res.status(500).json({ message: "Something went wrong." });
  }
};

exports.createCustomProduct = async (req, res) => {
  try {
    const period = req.body.period;
    const periodType = req.body.periodType;
    const amount = req.body.amount;
    const userId = req.body.userId;
    const scans = req.body.scans;
    const users = req.body.users;
    const annualPurchase = periodType === "monthly" ? false : true;
    const createdPlan = await stripe.products.create({
      name: `${userId} (${period} ${periodType} Plan)`,
      type: "service",
    });

    const price = await stripe.prices.create({
      product: createdPlan.id,
      unit_amount: parseInt(amount) * 100, // Amount in cents
      currency: "aud",
      recurring: {
        interval: periodType,
        interval_count: period,
      },
    });

    try {
      const createdProduct = new StripeProduct({
        userId: userId,
        stripeProductId: createdPlan.id,
        priceId: price.id,
        amount: amount * 100,
        periodType: periodType,
        period: period,
        users: users,
        scans: scans,
      });
      const user = await User.findById(mongoose.Types.ObjectId(userId));

      const savedProduct = await createdProduct.save();
      emailProvider.sendInvoice(user.email, savedProduct._id);

      return res.status(200).json({
        message: "Product Created.",
        productId: savedProduct._id,
      });
    } catch (err) {
      console.log("ERROR", err);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error creating product" });
  }
};

exports.createCustomSubscription = async (req, res) => {
  try {
    let stripeProduct;

    const period = req.body.period;
    const periodType = req.body.periodType;
    const amount = req.body.amount;
    const userId = req.body.userId;
    const scans = req.body.scans;
    const users = req.body.users;
    const dynamicQRs = req.body.dynamicQRs;

    const user = await User.findById(mongoose.Types.ObjectId(userId));

    if (!user) {
      return res.status(400).json({ status: 404, data: "user not found" });
    }

    const createdPlan = await stripe.products.create({
      name: `${userId} (${period} ${periodType} Plan)`,
      type: "service",
    });
    const proration_date = Math.floor(Date.now() / 1000);

    const price = await stripe.prices.create({
      product: createdPlan.id,
      unit_amount: parseInt(amount) * 100, // Amount in cents
      currency: "aud",
      recurring: {
        interval: periodType,
        interval_count: period,
      },
    });

    const createdProduct = new StripeProduct({
      userId: userId,
      stripeProductId: createdPlan.id,
      priceId: price.id,
      amount: amount * 100,
      periodType: periodType,
      period: period,
      users: users,
      scans: scans,
      dynamicQRs: dynamicQRs,
    });
    stripeProduct = await createdProduct.save();

    const existingPlan = await subscription.findOne({
      userId,
      paymentStatus: { $eq: "SUCCESS" },
      stripeSubscriptionPaid: true,
      stripeSubscriptionStatus: "active",
    });

    if (existingPlan) {
      const current_stripe_subscription = await stripe.subscriptions.retrieve(
        existingPlan?.subscriptionId
      );

      if (!current_stripe_subscription) {
        return res.status(404).json({
          message: "No Current Subscription is found.",
        });
      }

      stripe.subscriptions.update(existingPlan?.subscriptionId, {
        items: [
          {
            id: current_stripe_subscription.items.data[0].id,
            price: stripeProduct.priceId,
          },
        ],
        proration_date: proration_date,
        cancel_at_period_end: false,
        proration_behavior: "always_invoice",
      });

      await subscription.findByIdAndUpdate(existingPlan._id, {
        planName: "ENTERPRISE",
        stripePriceId: stripeProduct.priceId,
        amount: amount,
        appliedToCancel: false,
        annualPurchase: periodType === "month" ? false : true,
      });

      return res.status(200).json({ data: "subscription updated" });
    }

    let customerId;

    if (!user?.stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user?.firstName || "" + " " + user?.lastName || "",
        metadata: { userId: userId.toString() },
      });
      await User.findByIdAndUpdate(user._id, {
        stripeCustomerId: customer.id,
      });
      customerId = customer.id;
    } else {
      customerId = user.stripeCustomerId;
    }

    const existingPendingSubscription = await subscription.findOne({
      stripeCustomerId: customerId,
      paymentStatus: "PENDING",
    });

    const session = await stripe.checkout.sessions.create({
      metadata: { userId: userId.toString() },
      line_items: [{ price: stripeProduct.priceId, quantity: 1 }],
      mode: "subscription",
      billing_address_collection: "required",
      payment_method_collection: "always",
      success_url: process.env.QR_APP + "make-payment/?s=true",
      cancel_url: process.env.QR_APP + "make-payment/?s=false",
      customer: customerId,
    });
    const subscriptionData = {
      userId: stripeProduct.userId,
      amount: stripeProduct.amount,
      paymentStatus: "PENDING",
      annualPurchase: stripeProduct.periodType === "month" ? false : true,
      sessionId: session.id,
      stripeProductId: stripeProduct._id,
      planName: "ENTERPRISE",
      stripeCustomerId: session.customer,
    };

    if (!existingPendingSubscription) {
      const newSubscription = new subscription(subscriptionData);
      await newSubscription.save();
    } else if (existingPendingSubscription) {
      await subscription.findOneAndUpdate(
        {
          _id: existingPendingSubscription._id,
        },
        subscriptionData
      );
    }

    emailProvider.sendInvoice(user.email, session.url);
    return res.status(200).json({
      status: 200,
      url: session.url,
    });
  } catch (error) {
    console.log("error", error);
    res.status(500).json({ error: error });
  }
};

exports.currentSubscription = (userId) => {
  const activeSubscriptionFound = subscription.findOne({
    userId: userId,
    paymentStatus: "SUCCESS",
    stripeSubscriptionStatus: "active",
    stripeSubscriptionPaid: true,
  });

  return activeSubscriptionFound;
};

exports.getCardDetails = async (req, res) => {
  try {
    const card = await stripe.customers.listSources("cus_OtbWHJfXlcQPLd");
    console.log("CARD", card);
  } catch (error) {
    console.log("error", error);
    res.status(500).json({ error: error });
  }
};
