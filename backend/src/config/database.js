import mongoose from 'mongoose'
import { config } from './env.js'

mongoose.set('strictQuery', true)

export const connectDatabase = (uri = config.mongoUri) => mongoose.connect(uri, {
  autoIndex: config.nodeEnv !== 'production',
  maxPoolSize: 20,
  minPoolSize: config.nodeEnv === 'production' ? 2 : 0,
  serverSelectionTimeoutMS: 10_000,
})

export const disconnectDatabase = () => mongoose.disconnect()
