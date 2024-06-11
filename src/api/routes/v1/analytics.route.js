const express = require('express')
const validate = require('express-validation')
const controller = require('../../controllers/analytics.controller')
const { authorize, sameUser } = require('../../middlewares/auth')
const {
  timeBased,
  analyticsById,
  create,
  scanCount,
  query
} = require('../../validations/analytics.validation')
const {
  generateQuery,
  generateResourceQuery,
  generateCountQuery
} = require('../../middlewares/analytics')

const router = express.Router()

// methods to get the various type of analytics

router
  .route('/')
  .post(validate(create), controller.create)
  .get(
    authorize(),
    validate(query),
    generateQuery,
    controller.getAnalytics
  )

router
  .route('/time-based')
  .get(
    authorize(),
    validate(timeBased),
    controller.qrScansByTimePeriod
  )

router
  .route('/all-data')
  .get(authorize(), validate(analyticsById), controller.analyticsData)

// Route to get device analytics
router.get(
  '/devices',
  authorize(),
  validate(analyticsById),
  generateResourceQuery('device'),
  controller.getScanCountByGroup
)

// Route to get browser analytics
router.get(
  '/browsers',
  authorize(),
  validate(analyticsById),
  generateResourceQuery('browser'),
  controller.getScanCountByGroup
)

// Route to get location analytics
router.get(
  '/locations',
  authorize(),
  validate(analyticsById),
  generateResourceQuery('location.city'),
  controller.getScanCountByGroup
)

router.get(
  '/count',
  authorize(),
  validate(scanCount),
  generateCountQuery,
  controller.getScanCount
)
router.get(
  '/admin/analytics',
  controller.getUserDataCounts
)

module.exports = router
