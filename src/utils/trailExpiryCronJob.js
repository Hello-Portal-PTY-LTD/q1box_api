const User = require("../api/models/user.model");
const sgMail = require("@sendgrid/mail");
const { emailConfig } = require("../config/vars");

sgMail.setApiKey(emailConfig.sendGridApi);
module.exports.trailExpiryCronJob = async (email, name) => {
  let users = await User.find();

  let setTimeoutId = [];
  const cronJob = (runsAfter, user) => {
    let myJob = setTimeout(() => {
      const html = (fullname) => {
        return `
            <p>Hi ${fullname},</p>
            <p>Quick heads up – your 15 Days Free Trial with Q1box is ending soon. Starting [Date], your account will upgrade to premium, and you'll be billed as usual.</p>
            <p>If you're loving it, no action needed. Enjoy!</p>
            <p>Questions? Email us at support@helloportal.com.au.</p>
            <p>Cheers,</p>
            <p>Q1box Team</p>
            `;
      };
      const msg = {
        to: user.email,
        from: "support@q1box.com.au", // Replace with your email address
        subject: "Your 15 Days Free Trial Ends Soon!",
        html: html(`${user.firstName} ${user.lastName}`),
      };
      sgMail
        .send(msg)
        .then((res) => console.log("Send"))
        .catch((err) => console.log("Error"));
    }, runsAfter);
    setTimeoutId.push(myJob);
  };

  // Get the current date in milliseconds
  let currentDate = Date.now();

  // Calculate milliseconds for 3 days
  let threeDaysInMillis = 3 * 24 * 60 * 60 * 1000;
  // Subtract 3 days from the current date
  let threeDaysAgo = new Date(currentDate - threeDaysInMillis);

  let cronInterval = () => {
    intervalTime = 20000;
    setTimeoutId.map((id) => clearTimeout(id));
    setTimeoutId = [];
    let newArr = [];
    for (let i = 0; users.length > i; i++) {
      let difference =
        new Date(users[i].trialExpirationDate).getTime() - threeDaysAgo;
      if (new Date(users[i].trialExpirationDate).getTime() > threeDaysAgo) {
        newArr.push({ ...users[i], runsAfter: difference });
      }
    }
    newArr.forEach((item) => cronJob(item.runsAfter, item));
  };

  setTimeout(() => {
    cronInterval();
    setInterval(() => {
      cronInterval();
    }, 200000);
  }, 1000);
};
