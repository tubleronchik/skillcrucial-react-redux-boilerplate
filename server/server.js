import express from 'express'
import path from 'path'
import cors from 'cors'
import bodyParser from 'body-parser'
import sockjs from 'sockjs'
import { renderToStaticNodeStream } from 'react-dom/server'
import React from 'react'
import axios from 'axios'  

import cookieParser from 'cookie-parser'
import config from './config'
import Html from '../client/html'

const Root = () => ''
const { readFile, writeFile, unlink } = require('fs').promises

try {
  // eslint-disable-next-line import/no-unresolved
  // ;(async () => {
  //   const items = await import('../dist/assets/js/root.bundle')
  //   console.log(JSON.stringify(items))

  //   Root = (props) => <items.Root {...props} />
  //   console.log(JSON.stringify(items.Root))
  // })()
  console.log(Root)
} catch (ex) {
  console.log(' run yarn build:prod to enable ssr')
}

let connections = []

const port = process.env.PORT || 8090
const server = express()

const middleware = [
  cors(),
  express.static(path.resolve(__dirname, '../dist/assets')),
  bodyParser.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 }),
  bodyParser.json({ limit: '50mb', extended: true }),
  cookieParser()
]

middleware.forEach((it) => server.use(it))

// headers for requests

server.use((req, res, next) => {
  res.set('x-skillcrucial-user', 'd3f71027-b686-4134-8567-8ce38f5e923f')  
  res.set('Access-Control-Expose-Headers', 'X-SKILLCRUCIAL-USER')
  next()
})

// HW task1 API
function readingFile(data) {
  return JSON.parse(data)
}

 function addToFile(fileName, data) {
  return writeFile(`${__dirname}${fileName}`, JSON.stringify(data), { encoding: "utf8" }, (err) => console.log(err))
}

server.get('/api/v1/users', (req, res) => {
  readFile(`${__dirname}/users.json`)  
      .then(data => res.json(readingFile(data)))
        .catch(async () => {
          const { data: users } = await axios('https://jsonplaceholder.typicode.com/users')
          addToFile('/users.json', users) 
          res.json(users)
        }
        ) 
})

server.post('/api/v1/users', (req, res) => {
  readFile(`${__dirname}/users.json`)
    .then((data) => {
      const users = readingFile(data)
      const lastId = users[users.length - 1].id
      const { id, ...body } = req.body
      const newUsers = [...users, {id: lastId + 1, ...body}]
      return newUsers
    })
    .then(data => {
      addToFile('/users.json', data)
      const { id } = data[data.length - 1]
      res.json( {status: 'success', id})
    })
})

server.patch('/api/v1/users/:userId', (req, res) => {
  const { userId } = req.params
  readFile(`${__dirname}/users.json`)
    .then((data) => {
      const users = readingFile(data)
      const { id, ...body } = req.body
      const newArr = users.reduce((acc, user) => {
        return user.id === +userId ? [acc, {id: +userId, ...body}] : [...acc, user]
      })
      addToFile('/users.json', newArr)
      res.json({status: 'success', userId})
    })
})

server.delete('/api/v1/users/:userId', (req, res) => {
  const { userId } = req.params
  readFile(`${__dirname}/users.json`)
    .then(data => {
      const jsonData = readingFile(data)
      const reducedData = jsonData.filter((user) => user.id !== +userId)
      return reducedData
    })
    .then(newData => {
      addToFile('/users.json', newData)
      res.json({status: 'success', userId})
    })
})

server.delete('/api/v1/users/', (req,res) => {
  unlink(`${__dirname}/users.json`)
  res.json({status: 'success'})
})


server.get('/api/v1/user/:name', (req, res) => { 
  const { name } = req.params
  res.json(name)
})  

server.get('/api/v1/links/', async (req, res) => {
  const { data: todos } = await axios('https://jsonplaceholder.typicode.com/posts/5')
  res.json(todos)
})

server.use('/api/', (req, res) => {
  res.status(404)
  res.end()
})

const [htmlStart, htmlEnd] = Html({
  body: 'separator',
  title: 'Skillcrucial - Become an IT HERO'
}).split('separator')

server.get('/', (req, res) => {
  const appStream = renderToStaticNodeStream(<Root location={req.url} context={{}} />)
  res.write(htmlStart)
  appStream.pipe(res, { end: false })
  appStream.on('end', () => {
    res.write(htmlEnd)
    res.end()
  })
})

server.get('/*', (req, res) => {
  const initialState = {
    location: req.url
  }

  return res.send(
    Html({
      body: '',
      initialState
    })
  )
})

const app = server.listen(port)

if (config.isSocketsEnabled) {
  const echo = sockjs.createServer()
  echo.on('connection', (conn) => {
    connections.push(conn)
    conn.on('data', async () => {})

    conn.on('close', () => {
      connections = connections.filter((c) => c.readyState !== 3)
    })
  })
  echo.installHandlers(app, { prefix: '/ws' })
}
console.log(`Serving at http://localhost:${port}`)
