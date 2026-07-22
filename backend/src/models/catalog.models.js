import mongoose from 'mongoose'

const { Schema, model, models } = mongoose
const money = { type: Number, min: 0, default: 0 }

const storeSettingSchema = new Schema({
  singleton: { type: String, default: 'default', unique: true },
  storeName: { type: String, required: true, default: 'Goldex' }, legalName: String, logoUrl: String,
  currencyCode: { type: String, default: 'AED' }, currencySymbol: { type: String, default: 'AED' }, countryCode: { type: String, default: 'AE' },
  supportEmail: String, supportPhone: String, whatsappNumber: String, address: { type: Schema.Types.Mixed, default: {} }, socialLinks: { type: Schema.Types.Mixed, default: {} },
  shippingFee: { type: Number, min: 0, default: 0 }, freeShippingThreshold: { type: Number, min: 0, default: 0 }, returnWindowDays: { type: Number, min: 0, default: 7 },
  goldSchemeEnabled: { type: Boolean, default: true }, codEnabled: { type: Boolean, default: true }, onlinePaymentEnabled: { type: Boolean, default: false }, bankTransferEnabled: { type: Boolean, default: true },
  codMinOrderAmount: { type: Number, min: 0, default: 0 }, codMaxOrderAmount: { type: Number, min: 0, default: null }, minimumOrderAmount: { type: Number, min: 0, default: 0 }, paymentTimeoutMinutes: { type: Number, min: 1, default: 30 },
}, { timestamps: true })

const taxSettingSchema = new Schema({
  singleton: { type: String, default: 'default', unique: true }, taxName: { type: String, default: 'VAT' }, taxPercent: { type: Number, min: 0, max: 100, default: 5 },
  taxMode: { type: String, enum: ['inclusive', 'exclusive'], default: 'exclusive' }, taxRegistrationNumber: String,
  applyOn: { type: String, enum: ['total', 'making_only'], default: 'total' }, isActive: { type: Boolean, default: true },
}, { timestamps: true })

const categorySchema = new Schema({
  parentId: { type: Schema.Types.ObjectId, ref: 'Category', default: null }, name: { type: String, required: true }, nameAr: String,
  slug: { type: String, required: true, unique: true, lowercase: true }, description: String, descriptionAr: String, imageUrl: String,
  displayOrder: { type: Number, default: 0 }, isActive: { type: Boolean, default: true },
}, { timestamps: true })
categorySchema.index({ isActive: 1, displayOrder: 1, name: 1 })

const brandSchema = new Schema({
  name: { type: String, required: true },
  nameAr: String,
  slug: { type: String, required: true, unique: true, lowercase: true },
  description: String,
  descriptionAr: String,
  /** Legacy single logo; preserved when responsive logos are set. */
  logoUrl: String,
  logoDesktopUrl: String,
  logoTabletUrl: String,
  logoMobileUrl: String,
  bannerDesktopUrl: String,
  bannerTabletUrl: String,
  bannerMobileUrl: String,
  displayOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true })
brandSchema.index({ isActive: 1, displayOrder: 1, name: 1 })

const productSchema = new Schema({
  categoryId: { type: Schema.Types.ObjectId, ref: 'Category' }, brandId: { type: Schema.Types.ObjectId, ref: 'Brand' },
  name: { type: String, required: true }, nameAr: String, slug: { type: String, required: true, unique: true, lowercase: true },
  description: String, descriptionAr: String, shortDescription: String, shortDescriptionAr: String,
  metalType: { type: String, enum: ['gold', 'diamond', 'gold_diamond', 'silver'], default: 'gold' }, metalColor: String,
  purity: { type: String, enum: ['14k', '18k', '21k', '22k', '24k', null], default: null },
  gender: { type: String, enum: ['unisex', 'male', 'female', 'boys', 'girls', 'infant', 'kids'], default: 'unisex' }, occasion: [String],
  makingChargeType: { type: String, enum: ['percent', 'flat'], default: 'percent' }, makingChargeValue: money,
  wastagePercent: money, taxTreatment: { type: String, enum: ['standard', 'investment_precious_metal_zero_rated', 'zero_rated', 'exempt'], default: 'standard' },
  isCustomizable: { type: Boolean, default: false }, customizationNote: String,
  status: { type: String, enum: ['draft', 'active', 'archived'], default: 'draft', index: true }, isFeatured: { type: Boolean, default: false },
  ratingAvg: { type: Number, min: 0, max: 5, default: 0 }, ratingCount: { type: Number, min: 0, default: 0 }, displayOrder: { type: Number, default: 0 },
}, { timestamps: true })
productSchema.index({ status: 1, categoryId: 1, displayOrder: 1, createdAt: -1 })

const variantSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true }, sku: { type: String, unique: true, sparse: true },
  label: String, labelAr: String, sizeLabel: String, purity: { type: String, enum: ['14k', '18k', '21k', '22k', '24k', null], default: null },
  jewelleryType: String, ringSize: String, bangleSize: String, chainLengthInch: Number, heightMm: Number, widthMm: Number, lengthMm: Number, diameterMm: Number, sizeUnit: String, taxTreatment: String,
  weightGrams: money, effectiveWeight: { type: Number, min: 0, default: null }, makingCharge: money, stoneCharge: money,
  fixedPrice: { type: Number, min: 0, default: null }, compareAtPrice: { type: Number, min: 0, default: null },
  stockQty: { type: Number, min: 0, default: 0 }, reservedQty: { type: Number, min: 0, default: 0 }, lowStockThreshold: { type: Number, min: 0, default: 2 },
  isActive: { type: Boolean, default: true }, metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true })
variantSchema.index({ stockQty: 1, lowStockThreshold: 1 })
variantSchema.index(
  { 'metadata.idempotencyKey': 1 },
  {
    unique: true,
    sparse: false,
    name: 'variants_metadata_idempotencyKey_unique',
    partialFilterExpression: { 'metadata.idempotencyKey': { $type: 'string' } },
  },
)

const productImageSchema = new Schema({ productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true }, variantId: { type: Schema.Types.ObjectId, ref: 'Variant' }, imageUrl: { type: String, required: true }, altText: String, displayOrder: { type: Number, default: 0 }, isPrimary: { type: Boolean, default: false } }, { timestamps: { createdAt: true, updatedAt: false } })
productImageSchema.index({ productId: 1 }, { unique: true, partialFilterExpression: { isPrimary: true }, name: 'productimages_primary_unique' })
const productStoneSchema = new Schema({
  variantId: { type: Schema.Types.ObjectId, ref: 'Variant', required: true, index: true },
  stoneRateId: { type: Schema.Types.ObjectId, ref: 'StoneRate', default: null },
  label: { type: String, default: null },
  stoneType: { type: String, required: true },
  grade: { type: String, default: null },
  unit: { type: String, enum: ['carat', 'piece'], default: 'piece' },
  pricingMode: { type: String, enum: ['rate', 'fixed'], default: 'rate' },
  stoneCount: { type: Number, min: 1, default: 1 },
  weight: { type: Number, min: 0, default: null },
  shape: { type: String, default: null },
  sizeMm: { type: Number, min: 0, default: null },
  settingType: { type: String, default: null },
  /** Complete line charge when pricingMode=fixed (AED). Not a per-unit rate. */
  manualCharge: { type: Number, min: 0, default: null },
  displayOrder: { type: Number, default: 0 },
}, { timestamps: { createdAt: true, updatedAt: false } })
productStoneSchema.pre('validate', function validateStoneInvariants(next) {
  const unit = this.unit === 'carat' ? 'carat' : 'piece'
  const mode = this.pricingMode === 'fixed' ? 'fixed' : 'rate'
  this.pricingMode = mode
  if (mode === 'fixed') {
    this.stoneRateId = null
    if (!(Number(this.manualCharge) >= 0) || !Number.isFinite(Number(this.manualCharge))) {
      return next(new Error('Fixed-price stones require a non-negative manual_charge'))
    }
  } else if (!this.stoneRateId) {
    return next(new Error('Rate-priced stones require stone_rate_id'))
  }
  if (unit === 'carat') {
    if (!(Number(this.weight) > 0) || !Number.isFinite(Number(this.weight))) {
      return next(new Error('Carat-rated stones require weight greater than zero'))
    }
  } else if (!(Number(this.stoneCount) >= 1) || !Number.isInteger(Number(this.stoneCount))) {
    return next(new Error('Piece-rated stones require stone_count of at least 1'))
  }
  return next()
})
const certificateSchema = new Schema({ productId: { type: Schema.Types.ObjectId, ref: 'Product', index: true }, variantId: { type: Schema.Types.ObjectId, ref: 'Variant' }, certNumber: String, authority: String, fileUrl: String, storageKey: String, metadata: { type: Schema.Types.Mixed, default: {} }, issuedDate: Date }, { timestamps: { createdAt: true, updatedAt: false } })
const bannerSchema = new Schema({
  position: {
    type: String,
    enum: ['hero', 'strip', 'collection', 'promo_top', 'deal', 'gifting', 'promo_bottom'],
    default: 'hero',
  },
  title: String,
  titleAr: String,
  subtitle: String,
  subtitleAr: String,
  eyebrow: String,
  eyebrowAr: String,
  imageUrl: String,
  imageUrlAr: String,
  mobileImageUrl: String,
  mobileImageUrlAr: String,
  ctaText: String,
  ctaTextAr: String,
  ctaLink: String,
  displayOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  startsAt: Date,
  endsAt: Date,
}, { timestamps: true })
const cmsPageSchema = new Schema({ slug: { type: String, required: true, unique: true }, title: String, titleAr: String, content: String, contentAr: String, isPublished: { type: Boolean, default: false } }, { timestamps: true })

export const StoreSetting = models.StoreSetting || model('StoreSetting', storeSettingSchema)
export const TaxSetting = models.TaxSetting || model('TaxSetting', taxSettingSchema)
export const Category = models.Category || model('Category', categorySchema)
export const Brand = models.Brand || model('Brand', brandSchema)
export const Product = models.Product || model('Product', productSchema)
export const Variant = models.Variant || model('Variant', variantSchema)
export const ProductImage = models.ProductImage || model('ProductImage', productImageSchema)
export const ProductStone = models.ProductStone || model('ProductStone', productStoneSchema)
export const Certificate = models.Certificate || model('Certificate', certificateSchema)
export const Banner = models.Banner || model('Banner', bannerSchema)
export const CmsPage = models.CmsPage || model('CmsPage', cmsPageSchema)
