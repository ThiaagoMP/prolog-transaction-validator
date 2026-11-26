export const reais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format

export const contar = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
