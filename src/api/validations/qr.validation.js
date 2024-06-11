const Joi = require("joi");
const QR = require("../models/qr.model");

const qrTypes = [
  "Url",
  "AdvanceLinks",
  "BusinessCard",
  "LandingPage",
  "ReviewCollector",
  "Calendar",
  "Menu",
  "Social",
  "AppDownload",
  "Location",
  "Sms",
  "MakeCall",
  "SendEmail",
  "ShowText",
  "DownloadPdf",
  "UploadImage",
  "Video",
  "Coupon",
  "Forms",
];

const qrStatuses = ["Deleted", "Archieved", "Blocked", "Active"];

module.exports = {
  // POST /v1/qr
  addQR: {
    body: {
      folder: Joi.string().regex(/^[a-fA-F0-9]{24}$/),
      qrStatus: Joi.string().valid(...qrStatuses),
      qrType: Joi.string()
        .valid(...qrTypes)
        .required(),
      eyeBall: Joi.string(),
      eyeFrame: Joi.string(),
      pattern: Joi.string(),
      bgColor: Joi.string(),
      fgColor: Joi.string(),
      qrFrame: Joi.string(),
      qrTemplate: Joi.string(),
      file: Joi.string(),
      phone: Joi.string(),
      qrEyeBallColor: Joi.string(),
      qrEyeFrameColor: Joi.string(),
      qrQuality: Joi.string(),
      qrErrorLevel: Joi.string(),
      qrFrameButtonText: Joi.string(),
      qrDownloadOption: Joi.string(),
      qrStyle: Joi.string(),
      logo: Joi.any(),
      logoSize: Joi.number(),
      message: Joi.string(),
      text: Joi.string(),
      qrImage: Joi.string(),
      qrTextColor: Joi.string(),
      qrFrameColor: Joi.string(),
      updateAndTrack: Joi.boolean(),
      businessCard: Joi.object({
        firstName: Joi.string(),
        lastName: Joi.string(),
        email: Joi.string().allow(""),
        workPhone: Joi.string().allow(""),
        mobilePhone: Joi.string(),
        companyName: Joi.string().allow(""),
        jobTitle: Joi.string().allow(""),
        street: Joi.string().allow(""),
        city: Joi.string().allow(""),
        zipcode: Joi.string().allow(""),
        website: Joi.string().allow(""),
        country: Joi.string().allow(""),
        state: Joi.string().allow(""),
        summary: Joi.string().allow(""),
      }),
      advanceLinks: Joi.object({
        links: Joi.array().allow(""),
        preview: {
          bgColor: Joi.string(),
          textColor: Joi.string(),
          coverImage: Joi.string(),
          profileImage: Joi.string(),
          name: Joi.string().allow(""),
        },
      }),
      appDownload: {
        googlePlayUrl: Joi.string(),
        appStoreUrl: Joi.string(),
      },
      coupon: {
        buttonLink: Joi.string(),
        buttonText: Joi.string(),
        couponDetails: Joi.string(),
        salePercentage: Joi.string(),
        couponTime: {
          hours: Joi.number(),
          minutes: Joi.number(),
          seconds: Joi.number(),
        },
        preview: {
          bgColor: Joi.string(),
          buttonColor: Joi.string(),
          textColor: Joi.string(),
          backGroundImage: Joi.string(),
        },
      },
      sms: {
        message: Joi.string(),
        phone: Joi.string(),
      },
      location: {
        mapUrl: Joi.string(),
        position: {
          lat: Joi.number(),
          lng: Joi.number(),
        },
        placeName: Joi.string(),
      },
      menu: {
        shopName: Joi.string(),
        description: Joi.string().allow(""),
        menuName: Joi.string().allow(""),
        buttonName: Joi.string(),
        storeLink: Joi.string(),
        preview: {
          bgColor: Joi.string(),
          textColor: Joi.string(),
          borderColor: Joi.string(),
          buttonColor: Joi.string(),
          coverImage: Joi.string().allow(""),
        },
        products: Joi.array().items(
          Joi.object({
            name: Joi.string(),
            price: Joi.number(),
            image: Joi.string(),
            bgColor: Joi.string(),
            textColor: Joi.string(),
          })
        ),
      },
      makeCall: {
        phone: Joi.string(),
      },
      uploadImage: {
        files: Joi.array(),
        backgroundColor: Joi.string(),
        galleryName: Joi.string().allow(""),
      },
      social: {
        links: Joi.array(),
        preview: {
          bgColor: Joi.string(),
          textColor: Joi.string(),
          coverImage: Joi.string(),
          profileImage: Joi.string(),
          profileName: Joi.string().allow(""),
          summary: Joi.string().allow(""),
        },
      },
      sendEmail: {
        email: Joi.string(),
        message: Joi.string(),
        subject: Joi.string(),
      },
      calendar: {
        url: Joi.string(),
      },
      landingPage: {
        url: Joi.string(),
        url2: Joi.string(),
        url3: Joi.string(),
      },
      video: {
        videoTitle: Joi.string(),
        videoUrl: Joi.string(),
        description: Joi.string(),
        preview: {
          backGroundColor: Joi.string(),
          buttonColor: Joi.string(),
          textColor: Joi.string(),
        },
      },
    },
  },
  getQR: {
    params: {
      // qrId: Joi.string()
      //   .regex(/^[a-fA-F0-9]{24}$/)
      //   .required(),
    },
  },
  updateQR: {
    body: {
      folder: Joi.string().regex(/^[a-fA-F0-9]{24}$/),
      qrStatus: Joi.string().valid(...qrStatuses),
      qrType: Joi.string().valid(...qrTypes),
      eyeBall: Joi.string(),
      eyeFrame: Joi.string(),
      pattern: Joi.string(),
      bgColor: Joi.string(),
      fgColor: Joi.string(),
      qrFrame: Joi.string(),
      qrTemplate: Joi.string(),
      logo: Joi.any(),
      eyeRadius: {
        innerRadius: Joi.array(),
        outerRadius: Joi.array(),
      },
      logoSize: Joi.number(),
      file: Joi.string(),
      phone: Joi.string(),
      qrDownloadOption: Joi.string(),
      qrEyeBallColor: Joi.string(),
      qrEyeFrameColor: Joi.string(),
      message: Joi.string(),
      text: Joi.string(),
      files: Joi.array(),
      qrTextColor: Joi.string(),
      qrFrameColor: Joi.string(),
      updateAndTrack: Joi.boolean(),
      businessCard: {
        firstName: Joi.string(),
        lastName: Joi.string(),
        email: Joi.string().allow(""),
        workPhone: Joi.string().allow(""),
        mobilePhone: Joi.string(),
        companyName: Joi.string().allow(""),
        jobTitle: Joi.string().allow(""),
        street: Joi.string().allow(""),
        city: Joi.string().allow(""),
        zipcode: Joi.string().allow(""),
        website: Joi.string().allow(""),
        country: Joi.string().allow(""),
        state: Joi.string().allow(""),
        summary: Joi.string().allow(""),
      },
      advanceLinks: Joi.object({
        links: Joi.array().allow(""),
        preview: {
          bgColor: Joi.string(),
          textColor: Joi.string(),
          coverImage: Joi.string(),
          profileImage: Joi.string(),
          name: Joi.string().allow(""),
        },
      }),
      appDownload: {
        googlePlayUrl: Joi.string(),
        appStoreUrl: Joi.string(),
      },
      forms: {
        url: Joi.string(),
      },
      uploadImage: {
        files: Joi.array(),
        backgroundColor: Joi.string(),
        galleryName: Joi.string().allow(""),
      },
      coupon: {
        buttonLink: Joi.string(),
        buttonText: Joi.string(),
        couponNo: Joi.string(),
        couponNo: Joi.string(),
        couponDetails: Joi.string(),
        salePercentage: Joi.string(),
        couponTime: {
          hours: Joi.number(),
          minutes: Joi.number(),
          seconds: Joi.number(),
        },
        preview: {
          bgColor: Joi.string(),
          buttonColor: Joi.string(),
          textColor: Joi.string(),
          backGroundImage: Joi.string(),
        },
      },
      sms: {
        message: Joi.string(),
        phone: Joi.string(),
      },
      location: {
        mapUrl: Joi.string(),
        position: {
          lat: Joi.number(),
          lng: Joi.number(),
        },
        placeName: Joi.string(),
      },
      menu: {
        shopName: Joi.string(),
        description: Joi.string().allow(""),
        menuName: Joi.string().allow(""),
        buttonName: Joi.string(),
        storeLink: Joi.string(),
        preview: {
          bgColor: Joi.string(),
          textColor: Joi.string(),
          buttonColor: Joi.string(),
          borderColor: Joi.string(),
          coverImage: Joi.string().allow(""),
        },
        products: Joi.array().items(
          Joi.object({
            name: Joi.string(),
            price: Joi.number(),
            image: Joi.string(),
            bgColor: Joi.string(),
            textColor: Joi.string(),
          })
        ),
      },
      social: Joi.object({
        links: Joi.array(),
        preview: {
          bgColor: Joi.string(),
          textColor: Joi.string(),
          coverImage: Joi.string(),
          profileImage: Joi.string(),
          profileName: Joi.string().allow(""),
          summary: Joi.string().allow(""),
        },
      }).unknown(false),
      video: {
        videoTitle: Joi.string(),
        videoUrl: Joi.string(),
        description: Joi.string(),
        preview: {
          backGroundColor: Joi.string(),
          buttonColor: Joi.string(),
          textColor: Joi.string(),
        },
      },
    },
    showText: {
      text: Joi.string(),
    },
    params: {
      // qrId: Joi.string()
      //   .regex(/^[a-fA-F0-9]{24}$/)
      //   .required(),
    },
  },
  deleteQR: {
    params: {
      qrId: Joi.string()
        .regex(/^[a-fA-F0-9]{24}$/)
        .required(),
    },
  },
  userQR: {
    params: {
      userId: Joi.string()
        .regex(/^[a-fA-F0-9]{24}$/)
        .required(),
    },
  },
};
