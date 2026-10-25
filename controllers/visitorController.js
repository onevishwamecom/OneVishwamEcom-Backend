const VisitorCounter = require('../models/VisitorCounter');
const VisitorSession = require('../models/VisitorSession');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

// Seed minimum starting count for vibrant production feel if brand new
const SEED_TOTAL_VISITORS = 4450;
const SEED_TODAY_VISITORS = 280;

// Active threshold: consider visitor online if heartbeat received within last 45 seconds
const ACTIVE_THRESHOLD_MS = 45 * 1000;

function getTodayString() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function parseSessionIdentifier(req) {
  const visitorId = req.body?.visitorId || req.query?.visitorId || req.headers['x-visitor-id'] || '';
  const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const userAgent = req.headers['user-agent'] || '';
  return {
    visitorId,
    clientIp,
    userAgent,
    sessionIdentifier: visitorId ? `uid_${visitorId}` : `ip_${clientIp}_${userAgent.slice(0, 80)}`,
  };
}

async function countActiveVisitors() {
  const activeThreshold = new Date(Date.now() - ACTIVE_THRESHOLD_MS);
  const count = await VisitorSession.countDocuments({
    isOnline: true,
    lastSeenAt: { $gte: activeThreshold },
  }).catch(() => 0);
  return Math.max(count, 1);
}

/**
 * POST /api/visitors/hit (or GET /api/visitors/hit)
 * Records a visitor hit atomically.
 * Deduplicates repeated refreshes within a 24-hour window using VisitorSession with MongoDB TTL.
 */
const recordHit = asyncHandler(async (req, res) => {
  const today = getTodayString();
  const { visitorId, clientIp, userAgent, sessionIdentifier } = parseSessionIdentifier(req);

  let isNewVisitor = false;
  try {
    const sessionRes = await VisitorSession.updateOne(
      { identifier: sessionIdentifier },
      {
        $setOnInsert: {
          identifier: sessionIdentifier,
          ip: clientIp,
          userAgent: userAgent.slice(0, 150),
          createdAt: new Date(),
        },
        $set: {
          lastSeenAt: new Date(),
          isOnline: true,
        },
      },
      { upsert: true }
    );
    isNewVisitor = Boolean(sessionRes.upsertedCount > 0);
  } catch (err) {
    isNewVisitor = false;
    await VisitorSession.updateOne(
      { identifier: sessionIdentifier },
      { $set: { lastSeenAt: new Date(), isOnline: true } }
    ).catch(() => {});
  }

  // Atomically update aggregate counter document
  let counter = await VisitorCounter.findOne({ key: 'global' });
  if (!counter) {
    counter = await VisitorCounter.create({
      key: 'global',
      totalHits: SEED_TOTAL_VISITORS + 1,
      totalVisitors: SEED_TOTAL_VISITORS + 1,
      todayDate: today,
      todayHits: SEED_TODAY_VISITORS + 1,
      todayVisitors: SEED_TODAY_VISITORS + 1,
      lastActive: new Date(),
    });
  } else {
    const isNewDay = counter.todayDate !== today;

    const incOps = {
      totalHits: 1,
      ...(isNewVisitor ? { totalVisitors: 1 } : {}),
      ...(isNewDay
        ? {}
        : {
            todayHits: 1,
            ...(isNewVisitor ? { todayVisitors: 1 } : {}),
          }),
    };

    const setOps = {
      lastActive: new Date(),
      ...(isNewDay
        ? {
            todayDate: today,
            todayHits: 1,
            todayVisitors: isNewVisitor ? 1 : 0,
          }
        : {}),
    };

    counter = await VisitorCounter.findOneAndUpdate(
      { key: 'global' },
      { $inc: incOps, $set: setOps },
      { new: true, upsert: true }
    );
  }

  const activeVisitors = await countActiveVisitors();

  new ApiResponse(
    200,
    {
      totalVisitors: counter.totalVisitors || counter.totalHits || SEED_TOTAL_VISITORS,
      totalHits: counter.totalHits || counter.totalVisitors || SEED_TOTAL_VISITORS,
      visitsToday: counter.todayHits || counter.todayVisitors || SEED_TODAY_VISITORS,
      uniqueToday: counter.todayVisitors || 0,
      activeVisitors,
      isNewVisit: isNewVisitor,
    },
    'Visit recorded'
  ).send(res);
});

/**
 * POST /api/visitors/ping
 * Heartbeat ping sent while visitor has website tab open.
 * Refreshes lastSeenAt timestamp and returns latest real active count.
 */
const recordPing = asyncHandler(async (req, res) => {
  const { sessionIdentifier } = parseSessionIdentifier(req);

  await VisitorSession.updateOne(
    { identifier: sessionIdentifier },
    { $set: { lastSeenAt: new Date(), isOnline: true } }
  ).catch(() => {});

  const activeVisitors = await countActiveVisitors();

  new ApiResponse(200, { activeVisitors }, 'Heartbeat recorded').send(res);
});

/**
 * POST /api/visitors/leave
 * Fired via navigator.sendBeacon when tab is closed or user unloads page.
 * Instantly marks session offline so online count drops immediately.
 */
const recordLeave = asyncHandler(async (req, res) => {
  const { sessionIdentifier } = parseSessionIdentifier(req);

  await VisitorSession.updateOne(
    { identifier: sessionIdentifier },
    { $set: { isOnline: false } }
  ).catch(() => {});

  new ApiResponse(200, { success: true }, 'Visitor leave recorded').send(res);
});

/**
 * GET /api/visitors/count
 * Fetches the current aggregate visitor and page view counts.
 */
const getVisitorCount = asyncHandler(async (req, res) => {
  const today = getTodayString();
  let counter = await VisitorCounter.findOne({ key: 'global' }).lean();

  if (!counter) {
    counter = {
      totalVisitors: SEED_TOTAL_VISITORS,
      totalHits: SEED_TOTAL_VISITORS,
      todayDate: today,
      todayHits: SEED_TODAY_VISITORS,
      todayVisitors: SEED_TODAY_VISITORS,
    };
  }

  const visitsToday = counter.todayDate === today ? (counter.todayHits || counter.todayVisitors || 0) : 0;
  const activeVisitors = await countActiveVisitors();

  new ApiResponse(
    200,
    {
      totalVisitors: counter.totalVisitors || counter.totalHits || SEED_TOTAL_VISITORS,
      totalHits: counter.totalHits || counter.totalVisitors || SEED_TOTAL_VISITORS,
      visitsToday: visitsToday || SEED_TODAY_VISITORS,
      uniqueToday: counter.todayVisitors || 0,
      activeVisitors,
    },
    'Visitor count fetched'
  )
    .setCache(10, 15, 30) // Low cache for real-time responsiveness
    .send(res);
});

module.exports = {
  recordHit,
  recordPing,
  recordLeave,
  getVisitorCount,
  countActiveVisitors,
};
