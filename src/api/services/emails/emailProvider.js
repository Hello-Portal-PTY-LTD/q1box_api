const Email = require("email-templates");
const sgMail = require("@sendgrid/mail");
const { emailConfig } = require("../../../config/vars");

sgMail.setApiKey(emailConfig.sendGridApi);

exports.sendPasswordReset = async (passwordResetObject) => {
  try {
    const email = new Email({
      views: { root: __dirname },
    });
    const resetLink =
      process.env.QR_APP +
      `/resetpassword?token=${passwordResetObject.resetToken}&email=${passwordResetObject.userEmail}`;
    const html = await email.render("password-reset", {
      resetLink,
      productName: "Q1 BOX",
    });

    const msg = {
      to: passwordResetObject.userEmail,
      from: "support@q1box.com.au", // Replace with your email address
      subject: "Password Reset Request",
      html,
    };

    await sgMail.send(msg);
    console.log("Password reset request email sent successfully.");
  } catch (error) {
    console.error("Error sending password reset request email:", error);
  }
};

exports.SignUpVerification = async (token, Ema) => {
  try {
    const email = new Email({
      views: { root: __dirname },
    });
    const resetLink =
      process.env.QR_APP + `/signin?token=${token.accessToken}&email=${Ema}`;

    const html = await email.render("email-verification", {
      resetLink,
      productName: "Q1 Box",
      bodyText: "Click on the link below to verify your email.",
    });
    const msg = {
      to: Ema,
      from: "support@q1box.com.au", // Replace with your email address
      subject: "Please verify your Q1 Box account.",
      html,
    };

    await sgMail.send(msg);
    console.log("Password reset request email sent successfully.");
  } catch (error) {
    console.error("Error sending password reset request email:", error);
  }
};

exports.sendPasswordChangeEmail = async (user) => {
  console.log("sendPasswordChangeEmail triggered");
  try {
    const email = new Email({
      views: { root: __dirname },
    });

    const html = await email.render("passwordChange", {
      productName: "Q1 BOX",
      name: user.firstName + " " + user.lastName,
    });

    const msg = {
      to: user.email,
      from: "support@q1box.com.au",
      subject: "Password Changed",
      html,
    };

    await sgMail.send(msg);
  } catch (error) {
    console.error("Error sending password reset email:", error);
  }
};
exports.inviteUser = async (user, password) => {
  try {
    const email = new Email({
      views: { root: __dirname },
    });

    const html = await email.render("invitation", {
      productName: "Q1 BOX",
      name: user.firstName + " " + user.lastName,
      email: user.email,
      password: password,
    });

    const msg = {
      to: user.email,
      from: "support@q1box.com.au",
      subject: "Invitation To Q1 BOX",
      html,
    };

    await sgMail.send(msg);
    console.log("Invitation email sent successfully.");
  } catch (error) {
    console.error("Error sending invitation email:", error);
  }
};

exports.updateEmailOPT = async (newEmail, OPT) => {
  try {
    const email = new Email({
      views: { root: __dirname },
    });
    const html = await email.render("email-verification", {
      OPT,
      productName: "Q1 Box",
      bodyText:
        "Use this OPT Code in your application to verify your new email.",
    });

    const msg = {
      to: newEmail,
      from: "support@q1box.com.au",
      subject: "Verify your new email",
      html,
    };

    await sgMail.send(msg);
    console.log("Verify new email sent");
  } catch (error) {
    console.error("Error sending verify new email:", error);
  }
};

exports.sendInvoice = async (sendEmail, sessionUrl) => {
  try {
    const email = new Email({
      views: { root: __dirname },
    });
    const html = await email.render("send-invoice", {
      purchaseLink: sessionUrl,
      productName: "Q1 Box",
    });

    const msg = {
      to: sendEmail,
      from: "support@q1box.com.au",
      subject: "Custom Plan Purchase",
      html,
    };

    await sgMail.send(msg);
    console.log("Invoice email sent");
  } catch (error) {
    console.error("Error sending invoice email:", error);
  }
};
