const byteLength = (value) => new TextEncoder().encode(value).length
const field = (id, value) => `${id}${String(byteLength(value)).padStart(2, '0')}${value}`

const sanitize = (value, maxLength) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase()
  .replace(/[^A-Z0-9 $%*+\-./:]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, maxLength)

const crc16 = (value) => {
  const bytes = new TextEncoder().encode(value)
  let crc = 0xFFFF
  for (const byte of bytes) {
    crc ^= byte << 8
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

const isValidCpf = (digits) => {
  if (/^(\d)\1{10}$/.test(digits)) return false
  for (let length = 9; length <= 10; length += 1) {
    let sum = 0
    for (let index = 0; index < length; index += 1) sum += Number(digits[index]) * (length + 1 - index)
    const remainder = (sum * 10) % 11
    if ((remainder === 10 ? 0 : remainder) !== Number(digits[length])) return false
  }
  return true
}

export function normalizePixKey(value) {
  const key = String(value || '').trim()
  const digits = key.replace(/\D/g, '')
  if (key.startsWith('+')) return `+${digits}`
  if (digits.length === 11 && (/[()]/.test(key) || !isValidCpf(digits))) return `+55${digits}`
  if (digits.length === 14 && /^[\d./-]+$/.test(key)) return digits
  return key
}

export function buildPixPayload({ key, amountCents, merchantName, merchantCity, txid }) {
  const pixKey = normalizePixKey(key)
  if (!pixKey || pixKey.length > 77) throw new Error('Chave Pix inválida.')

  const merchantAccount = field('00', 'BR.GOV.BCB.PIX') + field('01', pixKey)
  const additionalData = field('05', sanitize(txid || '***', 25) || '***')
  const amount = (Number(amountCents) / 100).toFixed(2)
  const payload = [
    field('00', '01'),
    field('26', merchantAccount),
    field('52', '0000'),
    field('53', '986'),
    field('54', amount),
    field('58', 'BR'),
    field('59', sanitize(merchantName, 25) || 'LOJA'),
    field('60', sanitize(merchantCity, 15) || 'SAO PAULO'),
    field('62', additionalData),
    '6304',
  ].join('')

  return `${payload}${crc16(payload)}`
}
