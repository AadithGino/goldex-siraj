/** Legacy reference slugs — storefront links come from published CMS pages in admin. */
export const POLICY_PAGES = [
  { slug: 'terms-and-conditions', label: 'Terms & Conditions', labelAr: 'الشروط والأحكام' },
  { slug: 'privacy-policy', label: 'Privacy Policy', labelAr: 'سياسة الخصوصية' },
  { slug: 'delivery-shipping-policy', label: 'Delivery & Shipping Policy', labelAr: 'سياسة الشحن والتوصيل' },
  { slug: 'refund-policy', label: 'Refund Policy', labelAr: 'سياسة الاسترداد' },
]

export const POLICY_SLUGS = POLICY_PAGES.map((page) => page.slug)

export function getPolicyLabel(policy, lang = 'en') {
  if (lang === 'ar' && policy.labelAr) return policy.labelAr
  return policy.label
}
