import postgres from 'postgres'

export const sql = postgres(process.env.DATABASE_URL ?? 'postgres://validacao:validacao@localhost:5432/validacao')
