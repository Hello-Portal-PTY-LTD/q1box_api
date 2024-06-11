const stripe = require("stripe")(process.env.STRIPE_SECRET);
const Subscription = require("../models/subscription.model");
const User = require("../models/user.model");
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
const sgMail = require("@sendgrid/mail");
const { emailConfig } = require("../../config/vars");
const discountCoupon = require("../models/discountCoupon");

sgMail.setApiKey(emailConfig.sendGridApi);

module.exports.stripeWebHook = async (request, response) => {
  const sig = request.headers["stripe-signature"];
  const event = request.body;

  switch (event.type) {
    case "customer.created": {
      try {
      } catch (error) {
        console.log("error in hook", error);
      }
    }
    case "customer.deleted": {
      try {
        break;
      } catch (error) {
        console.log("error in hook", error);
      }
    }

    case "customer.subscription.created": {
      try {
        const subscriptionId = event.data.object.id;
        const customer = event.data.object.customer;

        await Subscription.findOneAndUpdate(
          {
            stripeCustomerId: customer,
            paymentStatus: "PENDING",
          },
          {
            $set: {
              subscriptionId: subscriptionId,
            },
          }
        );

        break;
      } catch (error) {
        console.log("error in hook", error);
      }
    }
    case "checkout.session.completed": {
      try {
        const session = event.data.object;
        const sessionId = event.data.object.id;

        await Subscription.findOneAndUpdate(
          {
            sessionId: sessionId,
          },
          {
            customerDetails: session.customer_details.address,
          }
        );
        let couponCode = session.metadata?.couponCode;
        if (couponCode) {
          const couponSave = await discountCoupon.findOne({ id: couponCode });
          if (couponSave) {
            couponSave.usedBy.push(session.metadata?.userId);
            couponSave.redemptions = couponSave.redemptions + 1;
            await couponSave.save();
          }
        }
        break;
      } catch (error) {
        console.log("error in hook", error);
      }
    }

    case "invoice.payment_succeeded": {
      try {
        const invoice = event.data.object;

        console.log(
          "invoice OBJ ====================>>>>>>>>>>>>>>>>>",
          invoice,
          invoice
        );

        const subInfo = await Subscription.findOneAndUpdate(
          {
            subscriptionId: invoice.subscription,
          },
          {
            paymentStatus: "SUCCESS",
            stripeSubscriptionPaid: invoice.paid,
            stripePaidAmount: invoice.amount_paid,
          }
        );

        if (invoice.billing_reason === "subscription_create") {
          const subs = await Subscription.findOne({
            subscriptionId: invoice.subscription,
          });

          const user = await User.findOne({
            _id: subs?.userId,
          });

          const html = (fullname) => {
            return `
          <p>Hi ${fullname},</p>
          <p>Thanks for choosing the ${subs.planName} Plan. We're thrilled to have you on board!</p>
          <p>With your subscription, you now have access to premium features for an enhanced experience with Q1box.</p>
          <p>Remember, you can cancel anytime.</p>
          <p>If you need assistance, our customer support team is here to help:</p>
          <p>- Phone: 0731127930</p>
          <p>- Email: support@helloportal.com.au</p>
          <p>Looking forward to growing with you!</p>
          <p>Best regards,</p>
          <p>Q1box Support Team</p>
          `;
          };
          const msg = {
            to: user?.email,
            from: "support@q1box.com.au", // Replace with your email address
            subject: `Your ${subs.planName} Plan is Now Active!`,
            html: html(`${user.firstName} ${user.lastName}`),
          };

          sgMail
            .send(msg)
            .then((res) =>
              console.log(
                "email send ========================>>>>>>>>>>>>>>>>>>>>>>",
                res
              )
            )
            .catch((err) =>
              console.log(
                "email error ==================>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>",
                err
              )
            );
        }
        break;
      } catch (error) {
        console.log("error in hook", error);
      }
    }
    case "invoice.payment_failed": {
      try {
        const invoice = await event.data.object;

        await Subscription.findOneAndUpdate(
          {
            subscriptionId: invoice.subscription,
          },
          {
            paymentStatus: "FAIL",
            stripeSubscriptionPaid: invoice.paid,
            stripePaidAmount: invoice.amount_paid,
          }
        );
        break;
      } catch (error) {
        console.log("error in hook", error);
      }
    }
    case "payment_intent.succeeded": {
    }
    case "customer.subscription.updated":
      const subscription = await event.data.object;

      await Subscription.findOneAndUpdate(
        {
          subscriptionId: subscription.id,
        },
        {
          stripeSubscriptionStatus: subscription.status,
        }
      );

      const selectedExistingPlan = await Subscription.findOne({
        subscriptionId: subscription.id,
      });

      console.log("HERE IAM", subscription);
      if (!selectedExistingPlan) break;
      console.log("HERE IAM", selectedExistingPlan);

      const paymentMethod = await stripe.paymentMethods.attach(
        subscription.default_payment_method,
        {
          customer: subscription.customer,
        }
      );

      await stripe.customers.update(subscription.customer, {
        invoice_settings: {
          default_payment_method: paymentMethod.id,
        },
      });

      if (paymentMethod?.card?.brand) {
        await Subscription.findOneAndUpdate(
          {
            subscriptionId: subscription.id,
          },
          {
            cardDetails: {
              brand: paymentMethod?.card?.brand,
              last4: paymentMethod?.card?.last4,
            },
          }
        );
      }

      let couponCode = subscription.metadata?.couponCode;
      if (couponCode) {
        const couponSave = await discountCoupon.findOne({ id: couponCode });
        if (couponSave) {
          // Check if user_id is not present in usedBy array
          if (!couponSave.usedBy.includes(subscription.metadata?.userId)) {
            couponSave.usedBy.push(subscription.metadata?.userId);
            couponSave.redemptions = couponSave.redemptions + 1;
            await couponSave.save();
          }
        }
      }
      break;

    case "customer.subscription.deleted": {
      try {
        if (subscription.status === "cancelled") {
          let subs = User.findOne({
            subscriptionId: subscription.subscription,
          });
          const user = await User.findOne({
            _id: subs?.userId,
          });

          const html = (fullname) => {
            return `
          <p>Hi ${fullname},</p>
          <p>We appreciate your interest in the Premium Plan. Your subscription is now cancelled, and you won't be charged anymore.</p>
          <p>Feel free to come back whenever you're ready to subscribe again. We're here to support you.</p>
          <p>Share your thoughts on your experience, so we can make things even better for our customers in the future.</p>
          <p>Thanks for your ongoing support!</p>
          <p>Q1box</p>
          `;
          };

          const msg = {
            to: user?.email,
            from: "support@q1box.com.au", // Replace with your email address
            subject: "Your Q1box Subscription is Cancelled",
            html: html(`${user.firstName} ${user.lastName}`),
          };

          sgMail
            .send(msg)
            .then((res) =>
              console
                .log(
                  "email send ==================>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>",
                  res
                )
                .catch((err) =>
                  console.log(
                    "email error ==================>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>",
                    err
                  )
                )
            );
        }
        break;
        //send mail your Subscription Deleted Sucessfully
      } catch (error) {
        console.log("error in hook", error);
      }
    }
    default:
      console.log(`Unhandled event type ${event.type}`);
  }
  response.send();
};
