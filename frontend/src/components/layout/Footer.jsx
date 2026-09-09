import { Link } from 'react-router-dom'
import { Clock3, ExternalLink, Facebook, Instagram, Mail, MapPin, Phone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useStoreSettings } from '@/hooks/useStoreSettings'
import { BrandWordmark } from '@/components/ui/BrandLogo'
import { useContentLang } from '@/hooks/useContentLang'
import {
  STORE_EMAIL,
  STORE_COMPLIANCE_EMAIL,
  getStoreLegalName,
} from '@/lib/storeIdentity'
import { PolicyLinks } from '@/components/legal/PolicyLinks'
import { pickField } from '@/lib/contentLocale'
import { getEmirateLabel } from '@/lib/i18nLabels'
import { branchMapsUrl, formatBranchAddressLines } from '@/lib/storeBranches'

const PAYMENT_METHODS = [
  { key: 'visa', src: '/payments/visa.png', labelKey: 'nav:footer.payments.visa' },
  { key: 'mastercard', src: '/payments/mastercard.png', labelKey: 'nav:footer.payments.mastercard' },
  { key: 'tabby', src: '/payments/tabby.png', labelKey: 'nav:footer.payments.tabby' },
  { key: 'tamara', src: '/payments/tamara.png', labelKey: 'nav:footer.payments.tamara' },
  { key: 'amex', src: '/payments/amex.png', labelKey: 'nav:footer.payments.amex' },
  { key: 'cod', src: '/payments/cod.png', labelKey: 'nav:footer.payments.cod' },
]

function boutiqueLines(branch, t) {
  const emirate = branch.emirate ? getEmirateLabel(branch.emirate, t) : ''
  const country = !branch.country || /united arab emirates|^uae$/i.test(branch.country)
    ? t('common:countryUae')
    : branch.country
  return formatBranchAddressLines({ ...branch, emirate, country })
}

function BoutiqueCard({ branch, lang, t }) {
  const name = pickField(branch, 'name', lang) || t('nav:footer.boutiqueFallback')
  const hours = pickField(branch, 'hours', lang)
  const lines = boutiqueLines(branch, t)
  const mapsUrl = branchMapsUrl(branch)
  const phone = String(branch.phone || '').trim()

  return (
    <article className="flex h-full flex-col rounded-3xl border border-gold/20 bg-navy-2/55 p-5 shadow-[0_12px_28px_rgba(0,0,0,.18)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-gold/10 text-gold">
          <MapPin className="h-4 w-4" />
        </div>
        {branch.is_primary && (
          <span className="rounded-full border border-gold/40 bg-gold/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[.14em] text-gold">
            {t('nav:footer.flagship')}
          </span>
        )}
      </div>

      <h3 className="font-display mt-4 text-xl text-gold-3!">{name}</h3>

      {lines.length > 0 && (
        <p className="mt-2 text-sm leading-relaxed text-gold-3/75">
          {lines.map((line, i) => (
            <span key={`${i}-${line}`} className="block">{line}</span>
          ))}
        </p>
      )}

      <div className="mt-4 space-y-2 text-sm">
        {phone && (
          <a href={`tel:${phone.replace(/\s/g, '')}`} className="flex items-center gap-2 text-gold-3/85 hover:text-gold">
            <Phone className="h-3.5 w-3.5 shrink-0 text-gold" />
            <span dir="ltr">{phone}</span>
          </a>
        )}
        {hours && (
          <p className="flex items-center gap-2 text-gold-3/75">
            <Clock3 className="h-3.5 w-3.5 shrink-0 text-gold" />
            {hours}
          </p>
        )}
      </div>

      {mapsUrl && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-auto inline-flex items-center gap-1.5 pt-4 text-xs font-semibold uppercase tracking-[.12em] text-gold hover:text-gold-2"
        >
          {t('nav:footer.getDirections')}
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </article>
  )
}

export function Footer() {
  const { t } = useTranslation(['nav', 'common'])
  const lang = useContentLang()
  const { data: settings } = useStoreSettings()

  const legalName = getStoreLegalName(lang)
  const supportEmail = settings?.support_email || STORE_EMAIL
  const branches = settings?.branches || []

  return (
    <footer className="mt-auto bg-navy text-gold-3">
      <div className="mx-auto max-w-[1320px] px-4 py-10 sm:px-6 sm:py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center">
              <BrandWordmark className="h-9" />
            </div>
            <p className="mt-2 text-sm font-medium text-gold-3/90">{legalName}</p>
            <p className="mt-2 text-sm text-gold-3/80">{t('common:footerTagline')}</p>
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-[.12em] text-gold">{t('nav:footer.shopHeading')}</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link to="/search" className="hover:text-gold">{t('nav:footer.allJewellery')}</Link>
              </li>
              <li>
                <Link to="/custom-jewellery" className="hover:text-gold">{t('nav:footer.customJewellery')}</Link>
              </li>
              <li>
                <Link to="/sell-jewellery" className="hover:text-gold">{t('nav:footer.sellJewellery')}</Link>
              </li>
              {settings?.scheme_enabled && (
                <li>
                  <Link to="/scheme" className="hover:text-gold">{t('nav:footer.goldScheme')}</Link>
                </li>
              )}
            </ul>
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-[.12em] text-gold">{t('nav:footer.policiesHeading')}</p>
            <PolicyLinks variant="stacked" className="mt-3" linkClassName="hover:text-gold" />
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-[.12em] text-gold">{t('nav:footer.contactHeading')}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {settings?.support_phone && <li>{settings.support_phone}</li>}
              <li>
                <a href={`mailto:${supportEmail}`} className="hover:text-gold">
                  {supportEmail}
                </a>
              </li>
              <li>
                <span className="text-gold-3/60">{t('common:footerComplianceEmail')}: </span>
                <a href={`mailto:${STORE_COMPLIANCE_EMAIL}`} className="hover:text-gold">
                  {STORE_COMPLIANCE_EMAIL}
                </a>
              </li>
            </ul>
            <div className="mt-3 flex gap-3">
              <a href="#" className="rounded-full border border-gold/30 p-2 hover:bg-navy-2">
                <Instagram className="h-4 w-4" />
              </a>
              <a href="#" className="rounded-full border border-gold/30 p-2 hover:bg-navy-2">
                <Facebook className="h-4 w-4" />
              </a>
              <a href={`mailto:${supportEmail}`} className="rounded-full border border-gold/30 p-2 hover:bg-navy-2">
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        {branches.length > 0 && (
          <section className="mt-12 border-t border-gold/20 pt-10">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[.16em] text-gold">{t('nav:footer.boutiquesHeading')}</p>
                <div className="gold-rule mt-3" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {branches.map((branch, index) => (
                <BoutiqueCard
                  key={branch.id || branch._key || `${branch.name}-${index}`}
                  branch={branch}
                  lang={lang}
                  t={t}
                />
              ))}
            </div>
          </section>
        )}

        <section className="mt-12 border-t border-gold/20 pt-10">
          <div className="mb-6">
            <p className="text-xs font-black uppercase tracking-[.16em] text-gold">{t('nav:footer.paymentMethods')}</p>
            <div className="gold-rule mt-3" />
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {PAYMENT_METHODS.map((method) => {
              const label = t(method.labelKey)
              return (
                <li key={method.key}>
                  <div className="overflow-hidden rounded-2xl border border-gold/20 bg-ivory-2 shadow-[0_10px_24px_rgba(0,0,0,.16)]">
                    <div className="flex h-16 items-center justify-center bg-white px-3 sm:h-20">
                      <img
                        src={method.src}
                        alt=""
                        className="max-h-10 max-w-full object-contain sm:max-h-12"
                        loading="lazy"
                      />
                    </div>
                    <p className="bg-navy-2 px-2 py-2 text-center text-[10px] font-bold uppercase tracking-[.08em] text-gold-3 sm:text-[11px]">
                      {label}
                    </p>
                  </div>
                  <span className="sr-only">{label}</span>
                </li>
              )
            })}
          </ul>
        </section>

        <div className="mt-10 border-t border-gold/20 pt-6 text-center text-xs text-gold-3/70">
          {t('common:copyright', { year: new Date().getFullYear(), storeName: legalName })}
        </div>
      </div>
    </footer>
  )
}
