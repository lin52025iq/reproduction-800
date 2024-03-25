import express from 'express'
import expressWebsockets from 'express-ws'
import { Server } from '@hocuspocus/server'
import { Redis } from '@hocuspocus/extension-redis'
import bodyParser from 'body-parser'
import { XmlElement, XmlText, encodeStateAsUpdate, mergeUpdates } from 'yjs'
import { v4 as uuidv4 } from 'uuid'
import { Database } from '@hocuspocus/extension-database'
import { TiptapTransformer } from '@hocuspocus/transformer'
import { MongoClient } from 'mongodb'

let client, db
async function connectMongo() {
    client = new MongoClient('mongodb://localhost:27017/hocuspocus')
    await client.connect()
    await client.db('hocuspocus').command({ ping: 1 })
    db = client.db('hocuspocus')

    console.log('connected')
}

const port = process.env.NODE_PORT

const server = Server.configure({
    name: 'hocuspocus',
    port: port,
    timeout: 30000,
    debounce: 5000,
    maxDebounce: 30000,
    extensions: [
        new Redis({ host: 'localhost', port: 6379 }),
        new Database({
            fetch,
            store: ({ documentName, state }) => {
                store({ documentName, state })
                return Promise.resolve(void 0)

                // Why is there no problem when handled in such a manner?
                // return new Promise((resolve) => {
                //     setTimeout(() => {
                //         resolve(void 0)
                //     }, 100)
                // })
            }
        })
    ]
})

/** fetch yjs document or init default document */
async function fetch({ documentName }) {
    if (documentName) {
        const stores = db.collection('stores')
        const record = await stores.findOne({ documentName })

        if (record?.state?.buffer) {
            return Promise.resolve(record.state.buffer)
        }
    }

    const ydoc = TiptapTransformer.toYdoc({
        type: 'doc',
        content: [{ type: 'paragraph', attrs: { uuid: uuidv4() }, content: [{ type: 'text', text: 'init content' }] }]
    })
    return Promise.resolve(encodeStateAsUpdate(ydoc))
}

/** store yjs document */
async function store({ documentName, state }) {
    const stores = db.collection('stores')
    const record = await stores.findOne({ documentName })

    if (!record?.state) {
        await stores.insertOne({ documentName, state })
        return Promise.resolve()
    }

    const oldState = record.state.buffer
    if (state.equals(oldState)) return Promise.resolve()

    const newState = mergeUpdates([oldState, state])
    await stores.updateOne({ documentName }, { $set: { state: newState } })
}

const { app } = expressWebsockets(express())
app.use(bodyParser.json())

app.ws('/collaboration', (websocket, request) => {
    server.handleConnection(websocket, request)
})

app.post('/open-direct', async (request, response) => {
    console.log(request.body)
    const { documentName, data } = request.body
    const docConnection = await server.openDirectConnection(documentName, {})
    await docConnection.transact((doc) => {
        const texts = data.split('\n')
        const xmlFragment = doc.getXmlFragment('default')
        const list = []

        texts.forEach((text) => {
            const YXmlElement = new XmlElement('paragraph')
            list.push(YXmlElement)

            const YXmlText = new XmlText()
            YXmlElement.insert(0, [YXmlText])
            YXmlElement.setAttribute('uuid', uuidv4())
            YXmlText.insert(0, text)
        })
        xmlFragment.push(list)
    })
    await docConnection.disconnect()
    response.send('success')
})

await connectMongo()
app.listen(port, () => console.log(`Listening on http://127.0.0.1:${port}`))
