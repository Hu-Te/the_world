'use strict'

const http = require('http')
const { URL } = require('url')

const PORT = Number(process.env.DRAW_SYNC_PORT || 8787)
const TTL_MS = 30 * 60 * 1000
const rooms = new Map()

function json(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(JSON.stringify(data))
}

function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Draw-Role')
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    var body = ''
    req.on('data', function (chunk) {
      body += chunk
      if (body.length > 512000) {
        reject(new Error('payload too large'))
        req.destroy()
      }
    })
    req.on('end', function () {
      try {
        resolve(body ? JSON.parse(body) : null)
      } catch (e) {
        reject(new Error('invalid json'))
      }
    })
    req.on('error', reject)
  })
}

function getRoom(roomId) {
  var room = rooms.get(roomId)
  if (!room) {
    room = { state: null, guesses: [], guestAt: 0, hostAt: 0, updatedAt: Date.now() }
    rooms.set(roomId, room)
  }
  return room
}

const server = http.createServer(function (req, res) {
  cors(req, res)

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  var url
  try {
    url = new URL(req.url || '/', 'http://' + (req.headers.host || 'localhost'))
  } catch (e) {
    json(res, 400, { error: 'bad url' })
    return
  }

  var parts = url.pathname.split('/').filter(Boolean)

  if (parts[0] !== 'api' || parts[1] !== 'draw') {
    json(res, 404, { error: 'not found' })
    return
  }

  var roomId = parts[2]
  if (!roomId || !/^\d{6}$/.test(roomId)) {
    json(res, 400, { error: 'invalid room id' })
    return
  }

  var room = getRoom(roomId)
  var role = String(req.headers['x-draw-role'] || '')

  function handleRequest(body) {
    if (parts.length === 3 && req.method === 'GET') {
      room.updatedAt = Date.now()
      if (role === 'guest') room.guestAt = Date.now()
      if (role === 'host') room.hostAt = Date.now()

      var now = Date.now()
      json(res, 200, {
        state: room.state,
        guesses: role === 'host' ? room.guesses.splice(0) : [],
        guestOnline: now - room.guestAt < 6000,
        hostOnline: now - room.hostAt < 6000,
      })
      return
    }

    if (parts[3] === 'state' && req.method === 'POST') {
      room.state = body
      room.hostAt = Date.now()
      room.updatedAt = Date.now()
      json(res, 200, { ok: true })
      return
    }

    if (parts[3] === 'guess' && req.method === 'POST') {
      var text = body && body.text ? String(body.text).trim() : ''
      if (!text) {
        json(res, 400, { error: 'empty guess' })
        return
      }
      room.guesses.push({ text: text, at: Date.now() })
      room.guestAt = Date.now()
      room.updatedAt = Date.now()
      json(res, 200, { ok: true })
      return
    }

    json(res, 404, { error: 'not found' })
  }

  if (req.method === 'GET') {
    try {
      handleRequest(null)
    } catch (err) {
      json(res, 400, { error: err.message || 'bad request' })
    }
    return
  }

  readBody(req)
    .then(function (body) {
      handleRequest(body)
    })
    .catch(function (err) {
      json(res, 400, { error: err.message || 'bad request' })
    })
})

setInterval(function () {
  var now = Date.now()
  rooms.forEach(function (room, id) {
    if (now - room.updatedAt > TTL_MS) rooms.delete(id)
  })
}, 60000)

server.on('error', function (err) {
  if (err.code === 'EADDRINUSE') {
    console.error('[draw-sync] 端口 ' + PORT + ' 已被占用，请先执行: fuser -k ' + PORT + '/tcp')
  } else {
    console.error('[draw-sync] 启动失败:', err.message)
  }
  process.exit(1)
})

server.listen(PORT, '0.0.0.0', function () {
  console.log('[draw-sync] listening on http://0.0.0.0:' + PORT)
})
