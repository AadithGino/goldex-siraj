import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import mongoose from 'mongoose'
import { Brand, Category, Product, ProductImage, ProductStone, StoreSetting, TaxSetting, Variant } from '../src/models/catalog.models.js'
import { GoldRate, StoneRate } from '../src/models/rate.models.js'

const image = (path) => `https://s7ap1.scene7.com/is/image/malabargroup/mgdsite/products/permanent/india/gold%20ornaments/${path}?fmt=webp-alpha&wid=400&hei=400`
const stockQty = Math.max(Number(process.env.SEED_STOCK_QTY || 5), 0)
const vatPercent = Math.max(Number(process.env.SEED_VAT_PERCENT || 5), 0)

const rateDefaults = {
  '14k': 210,
  '18k': 270,
  '22k': 330,
  '24k': 360,
}

const goldRates = Object.entries(rateDefaults).map(([purity, fallback]) => ({
  purity,
  ratePerGram: Number(process.env[`SEED_GOLD_RATE_${purity.toUpperCase()}`] || fallback),
}))

const stoneRates = [
  { key: 'diamond-vs-carat', stoneType: 'Diamond', grade: 'VS', unit: 'carat', rate: Number(process.env.SEED_DIAMOND_RATE || 5000) },
  { key: 'cubic-zirconia-a-piece', stoneType: 'Cubic Zirconia', grade: 'A', unit: 'piece', rate: Number(process.env.SEED_CZ_RATE || 15) },
  { key: 'sapphire-aa-carat', stoneType: 'Sapphire', grade: 'AA', unit: 'carat', rate: Number(process.env.SEED_SAPPHIRE_RATE || 250) },
  { key: 'ruby-aa-carat', stoneType: 'Ruby', grade: 'AA', unit: 'carat', rate: Number(process.env.SEED_RUBY_RATE || 300) },
]

const ringVariants = (sku, weight, stone, purity = '18k') => ['12', '14', '16'].map((size, index) => ({
  sku: `${sku}-${purity.toUpperCase()}-${size}`,
  label: `${purity.toUpperCase()} / Size ${size}`,
  sizeLabel: size,
  ringSize: size,
  purity,
  weightGrams: Number((weight + index * 0.04).toFixed(3)),
  effectiveWeight: Number((weight - stone.weight * 0.2 + index * 0.04).toFixed(3)),
  stockQty,
  stone,
}))

const metalVariants = (sku, weights, stone) => Object.entries(weights).map(([purity, weight]) => ({
  sku: `${sku}-${purity.toUpperCase()}`,
  label: `${purity.toUpperCase()} Gold`,
  purity,
  weightGrams: weight,
  effectiveWeight: Number((weight - stone.weight * 0.2).toFixed(3)),
  stockQty,
  stone,
}))

// These weights, stone specifications, MC and wastage values are editable seed/demo
// data. Replace them with verified merchandise measurements before going live.
const products = [
  {
    category: 'nose-pins', name: 'Floral Diamond Nose Pin', slug: 'floral-diamond-nose-pin-npdzl40429', code: 'NPDZL40429-0001', metalType: 'gold_diamond', purity: '18k', makingChargeValue: 14, wastagePercent: 3.5, featured: true,
    images: [
      image('nose%20pin/NP-320603/NPDZL40429-0001/NPDZL40429-0001-1.jpg'),
      image('nose%20pin/NP-320603/NPDZL40429-0001/NPDZL40429-0001-2.jpg'),
      image('nose%20pin/NP-320603/NPDZL40429-0001/NPDZL40429-0001-3.jpg'),
    ],
    variants: metalVariants('NPDZL40429-0001', { '18k': 0.82, '22k': 0.9 }, { rateKey: 'diamond-vs-carat', count: 7, weight: 0.07 }),
  },
  {
    category: 'nose-pins', name: 'Classic Cluster Nose Pin', slug: 'classic-cluster-nose-pin-npdzl10350', code: 'NPDZL10350-0001', metalType: 'gold_diamond', purity: '18k', makingChargeValue: 13, wastagePercent: 3, featured: true,
    images: [
      image('nose%20pin/NP-040310/NPDZL10350-0001/NPDZL10350-0001-1.Jpg'),
      image('nose%20pin/NP-040310/NPDZL10350-0001/NPDZL10350-0001-2.Jpg'),
      image('nose%20pin/NP-040310/NPDZL10350-0001/NPDZL10350-0001-3.Jpg'),
    ],
    variants: metalVariants('NPDZL10350-0001', { '18k': 0.74, '22k': 0.81 }, { rateKey: 'diamond-vs-carat', count: 6, weight: 0.06 }),
  },
  {
    category: 'rings', name: 'Floral Halo Diamond Ring', slug: 'floral-halo-diamond-ring-frnkd-zl42396', code: 'FRNKDZL42396-0014', metalType: 'gold_diamond', purity: '18k', makingChargeValue: 16, wastagePercent: 5, featured: true,
    images: [
      image('finger%20ring/FR-334854/FRNKDZL42396-0014/FRNKDZL42396-0014-1.JPG'),
      image('finger%20ring/FR-334854/FRNKDZL42396-0014/FRNKDZL42396-0014-2.JPG'),
      image('finger%20ring/FR-334854/FRNKDZL42396-0014/FRNKDZL42396-0014-3.JPG'),
    ],
    variants: ringVariants('FRNKDZL42396-0014', 3.62, { rateKey: 'diamond-vs-carat', count: 19, weight: 0.28 }),
  },
  {
    category: 'rings', name: 'Petal Diamond Ring', slug: 'petal-diamond-ring-frdzl55825', code: 'FRDZL55825-0001', metalType: 'gold_diamond', purity: '18k', makingChargeValue: 15, wastagePercent: 4.5,
    images: [
      image('finger%20ring/FR-334814/FRDZL55825-0001/FRDZL55825-0001-1.JPG'),
      image('finger%20ring/FR-334814/FRDZL55825-0001/FRDZL55825-0001-2.JPG'),
      image('finger%20ring/FR-334814/FRDZL55825-0001/FRDZL55825-0001-3.JPG'),
    ],
    variants: ringVariants('FRDZL55825-0001', 3.28, { rateKey: 'diamond-vs-carat', count: 15, weight: 0.22 }),
  },
  {
    category: 'pendants', name: 'Radiant Drop Pendant', slug: 'radiant-drop-pendant-pddzl29722', code: 'PDDZL29722-0001', metalType: 'gold_diamond', purity: '18k', makingChargeValue: 15, wastagePercent: 4,
    images: [
      image('pendant/PD-030238/PDDZL29722-0001/PDDZL29722-0001-1.Jpg'),
      image('pendant/PD-030238/PDDZL29722-0001/PDDZL29722-0001-2.Jpg'),
    ],
    variants: metalVariants('PDDZL29722-0001', { '18k': 2.45, '22k': 2.68 }, { rateKey: 'diamond-vs-carat', count: 13, weight: 0.19 }),
  },
  {
    category: 'rings', name: 'Blue Sapphire Statement Ring', slug: 'blue-sapphire-statement-ring-frnob42687', code: 'FRNOB42687-0013', metalType: 'gold_diamond', purity: '18k', makingChargeValue: 17, wastagePercent: 5.5, featured: true,
    images: [
      image('finger%20ring/FR-317348/FRNOB42687-0013/FRNOB42687-0013-1.jpg'),
      image('finger%20ring/FR-317348/FRNOB42687-0013/FRNOB42687-0013-2.jpg'),
      image('finger%20ring/FR-317348/FRNOB42687-0013/FRNOB42687-0013-3.jpg'),
    ],
    variants: ringVariants('FRNOB42687-0013', 4.08, { rateKey: 'sapphire-aa-carat', count: 1, weight: 0.62 }),
  },
  {
    category: 'pendants', name: 'Nature Sparkle Pendant', slug: 'nature-sparkle-pendant-pdzns40746', code: 'PDZNS40746-0001', metalType: 'gold_diamond', purity: '18k', makingChargeValue: 15, wastagePercent: 4.25,
    images: [
      image('pendant/PD-292344/PDZNS40746-0001/PDZNS40746-0001-1.jpg'),
      image('pendant/PD-292344/PDZNS40746-0001/PDZNS40746-0001-2.jpg'),
      image('pendant/PD-292344/PDZNS40746-0001/PDZNS40746-0001-3.jpg'),
    ],
    variants: metalVariants('PDZNS40746-0001', { '18k': 2.82, '22k': 3.04 }, { rateKey: 'cubic-zirconia-a-piece', count: 18, weight: 0.24 }),
  },
  {
    category: 'rings', name: 'Twist Solitaire Ring', slug: 'twist-solitaire-ring-frdzl29028', code: 'FRDZL29028-0001', metalType: 'gold_diamond', purity: '18k', makingChargeValue: 14.5, wastagePercent: 4.75,
    images: [image('finger%20ring/FR-010626/FRDZL29028-0001/FRDZL29028-0001-3.Jpg')],
    variants: ringVariants('FRDZL29028-0001', 3.05, { rateKey: 'diamond-vs-carat', count: 1, weight: 0.18 }),
  },
  {
    category: 'rings', name: 'Everyday Sparkle Ring', slug: 'everyday-sparkle-ring-frdzl10036', code: 'FRDZL10036-0001', metalType: 'gold_diamond', purity: '18k', makingChargeValue: 14, wastagePercent: 4,
    images: [image('finger%20ring/FR-096587/FRDZL10036-0001/FRDZL10036-0001-1.jpg')],
    variants: ringVariants('FRDZL10036-0001', 2.94, { rateKey: 'cubic-zirconia-a-piece', count: 11, weight: 0.15 }),
  },
  {
    category: 'pendants', name: 'Ruby Bloom Pendant', slug: 'ruby-bloom-pendant-pddzl21311', code: 'PDDZL21311-0001', metalType: 'gold_diamond', purity: '18k', makingChargeValue: 16, wastagePercent: 4.5,
    images: [image('pendant/PD-135182/PDDZL21311-0001/PDDZL21311-0001-1.jpg')],
    variants: metalVariants('PDDZL21311-0001', { '18k': 2.76, '22k': 3.01 }, { rateKey: 'ruby-aa-carat', count: 1, weight: 0.42 }),
  },
]

function validateSeedData() {
  const productId = new mongoose.Types.ObjectId()
  const variantId = new mongoose.Types.ObjectId()
  const rateByKey = new Map(stoneRates.map((rate) => [rate.key, rate]))
  const skus = new Set()
  let variantCount = 0
  let imageCount = 0
  for (const entry of products) {
    const productError = new Product({ ...entry, categoryId: productId, brandId: productId, makingChargeType: 'percent', status: 'active', taxTreatment: 'standard' }).validateSync()
    if (productError) throw productError
    for (const imageUrl of entry.images) {
      const imageError = new ProductImage({ productId, imageUrl }).validateSync()
      if (imageError) throw imageError
      imageCount += 1
    }
    for (const variant of entry.variants) {
      if (skus.has(variant.sku)) throw new Error(`Duplicate seed SKU: ${variant.sku}`)
      skus.add(variant.sku)
      const rate = rateByKey.get(variant.stone.rateKey)
      if (!rate) throw new Error(`Missing stone rate: ${variant.stone.rateKey}`)
      if (!(variant.effectiveWeight > 0) || variant.effectiveWeight > variant.weightGrams) throw new Error(`Invalid net metal weight: ${variant.sku}`)
      const variantError = new Variant({ ...variant, productId, isActive: true }).validateSync()
      if (variantError) throw variantError
      const stoneError = new ProductStone({ variantId, stoneType: rate.stoneType, grade: rate.grade, unit: rate.unit, stoneCount: variant.stone.count, weight: variant.stone.weight }).validateSync()
      if (stoneError) throw stoneError
      variantCount += 1
    }
  }
  if (products.length !== 10 || imageCount !== 23 || variantCount !== 25) throw new Error('Seed catalogue counts are not as expected')
  process.stdout.write(`Seed data valid: ${products.length} products, ${variantCount} variants, ${imageCount} images and ${variantCount} stone lines.\n`)
}

async function seedRateCards() {
  for (const rate of goldRates) {
    await GoldRate.findOneAndUpdate({ purity: rate.purity, isCurrent: true }, { $set: { ratePerGram: rate.ratePerGram, effectiveAt: new Date() } }, { upsert: true, new: true, runValidators: true })
  }
  const rateMap = new Map()
  for (const rate of stoneRates) {
    const row = await StoneRate.findOneAndUpdate(
      { stoneType: rate.stoneType, grade: rate.grade, unit: rate.unit, isCurrent: true },
      { $set: { rate: rate.rate, effectiveAt: new Date() } },
      { upsert: true, new: true, runValidators: true },
    )
    rateMap.set(rate.key, row)
  }
  return rateMap
}

async function seedCatalog() {
  await connectDatabase()

  await StoreSetting.findOneAndUpdate(
    { singleton: 'default' },
    { $setOnInsert: { storeName: 'Goldex', currencyCode: process.env.SEED_CURRENCY_CODE || 'AED', currencySymbol: process.env.SEED_CURRENCY_SYMBOL || 'AED' } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
  await TaxSetting.findOneAndUpdate(
    { singleton: 'default' },
    { $set: { taxName: 'VAT', taxPercent: vatPercent, taxMode: 'exclusive', applyOn: 'total', isActive: true } },
    { upsert: true, new: true, runValidators: true },
  )

  const categoryMap = new Map()
  for (const [slug, name, displayOrder] of [['nose-pins', 'Nose Pins', 1], ['rings', 'Rings', 2], ['pendants', 'Pendants', 3]]) {
    const category = await Category.findOneAndUpdate({ slug }, { $set: { name, displayOrder, isActive: true } }, { upsert: true, new: true, runValidators: true })
    categoryMap.set(slug, category)
  }
  const brand = await Brand.findOneAndUpdate({ slug: 'goldex-curated' }, { $set: { name: 'Goldex Curated', isActive: true } }, { upsert: true, new: true, runValidators: true })
  const rateMap = await seedRateCards()

  let variantCount = 0
  let imageCount = 0
  let stoneCount = 0
  for (const [productIndex, entry] of products.entries()) {
    const product = await Product.findOneAndUpdate(
      { slug: entry.slug },
      { $set: { categoryId: categoryMap.get(entry.category).id, brandId: brand.id, name: entry.name, shortDescription: `${entry.purity.toUpperCase()} live-rate jewellery with transparent price breakup.`, description: `Catalog reference ${entry.code}. Price is calculated from live gold rate, net metal weight, wastage, making charge, stones and VAT.`, metalType: entry.metalType, metalColor: 'yellow', purity: entry.purity, gender: 'female', occasion: ['daily', 'gifting'], makingChargeType: 'percent', makingChargeValue: entry.makingChargeValue, wastagePercent: entry.wastagePercent, taxTreatment: 'standard', status: 'active', isFeatured: Boolean(entry.featured), displayOrder: productIndex + 1 } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    )

    await ProductImage.deleteMany({ productId: product.id })
    await ProductImage.insertMany(entry.images.map((imageUrl, index) => ({ productId: product.id, imageUrl, altText: `${entry.name} view ${index + 1}`, displayOrder: index, isPrimary: index === 0 })))
    imageCount += entry.images.length

    for (const variantEntry of entry.variants) {
      const variant = await Variant.findOneAndUpdate(
        { sku: variantEntry.sku },
        { $set: { productId: product.id, label: variantEntry.label, sizeLabel: variantEntry.sizeLabel, ringSize: variantEntry.ringSize, jewelleryType: entry.category === 'rings' ? 'ring' : entry.category === 'pendants' ? 'pendant' : 'nose_pin', purity: variantEntry.purity, weightGrams: variantEntry.weightGrams, effectiveWeight: variantEntry.effectiveWeight, makingCharge: 0, stoneCharge: 0, fixedPrice: null, lowStockThreshold: 2, isActive: true, metadata: { seeded: true, catalogReference: entry.code, grossWeightGrams: variantEntry.weightGrams, stoneWeightCarat: variantEntry.stone.weight } }, $setOnInsert: { stockQty: variantEntry.stockQty, reservedQty: 0 } },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
      )
      const rate = rateMap.get(variantEntry.stone.rateKey)
      await ProductStone.deleteMany({ variantId: variant.id })
      await ProductStone.create({ variantId: variant.id, stoneRateId: rate.id, stoneType: rate.stoneType, grade: rate.grade, unit: rate.unit, stoneCount: variantEntry.stone.count, weight: variantEntry.stone.weight, displayOrder: 0 })
      variantCount += 1
      stoneCount += 1
    }
  }

  process.stdout.write(`Catalog seeded: ${products.length} products, ${variantCount} variants, ${imageCount} images, ${stoneCount} stone lines, ${vatPercent}% VAT.\n`)
}

try {
  validateSeedData()
  if (!process.argv.includes('--dry-run')) await seedCatalog()
} catch (error) {
  process.stderr.write(`${error.stack || error.message}\n`)
  process.exitCode = 1
} finally {
  await disconnectDatabase()
}