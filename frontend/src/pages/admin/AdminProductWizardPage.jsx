import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { WizardStepper } from '@/components/admin/products/wizard/WizardStepper'
import { ProductBasicsStep } from '@/components/admin/products/wizard/ProductBasicsStep'
import { ProductVariantsStep } from '@/components/admin/products/wizard/ProductVariantsStep'
import { ProductImagesStep } from '@/components/admin/products/wizard/ProductImagesStep'
import { ProductCertificatesPanel } from '@/components/admin/products/ProductCertificatesPanel'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAdminProduct, useAdminProductMutations } from '@/hooks/useAdminProducts'
import { useAdminCategories } from '@/hooks/useAdminCategories'
import { useAdminBrands } from '@/hooks/useAdminBrands'
import { DEFAULT_PRODUCT, WIZARD_STEPS, toProductPayload, productToFormState } from '@/lib/productDefaults'

export function AdminProductWizardPage() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const step = Math.min(4, Math.max(1, Number(searchParams.get('step') || 1)))

  const { data: product, isLoading } = useAdminProduct(isNew ? null : id)
  const { data: categories } = useAdminCategories()
  const { data: brands } = useAdminBrands()
  const { createProduct, updateProduct } = useAdminProductMutations()
  const [form, setForm] = useState({ ...DEFAULT_PRODUCT })
  const [saving, setSaving] = useState(false)
  const [formSyncedForId, setFormSyncedForId] = useState(null)

  useEffect(() => {
    setFormSyncedForId(null)
  }, [id])

  useEffect(() => {
    if (!product?.id || product.id !== id || formSyncedForId === id) return
    setForm(productToFormState(product))
    setFormSyncedForId(id)
  }, [product, id, formSyncedForId])

  const variantCount = product?.product_variants?.length || 0
  const hasVariants = variantCount > 0
  const autoSlugFromName = isNew || form.slug?.startsWith('draft-')

  const canGoToStep = (targetStep) => {
    if (targetStep === 1) return true
    return !isNew
  }

  const goToStep = (targetStep) => {
    if (!canGoToStep(targetStep)) {
      toast.error('Save product info first to unlock other sections')
      return
    }
    setSearchParams({ step: String(targetStep) })
  }

  const saveBasics = async ({ silent = false } = {}) => {
    if (!form.name?.trim() || !form.slug?.trim()) {
      toast.error('Name and slug are required')
      return false
    }

    const payload = toProductPayload(form)
    setSaving(true)
    try {
      if (isNew) {
        const created = await createProduct.mutateAsync(payload)
        if (!silent) toast.success('Product info saved')
        navigate(`/admin/products/${created.id}/edit?step=2`, { replace: true })
      } else {
        await updateProduct.mutateAsync({ id, ...payload })
        if (!silent) toast.success('Product info saved')
      }
      return true
    } catch (err) {
      toast.error(err.message || 'Save failed')
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAndNext = async () => {
    if (step === 1) {
      const ok = await saveBasics()
      if (ok && !isNew) goToStep(2)
      return
    }
    if (step === 2) {
      if (!hasVariants) {
        toast.error('Add at least one variant before continuing')
        return
      }
      goToStep(3)
      return
    }
    if (step === 3) {
      goToStep(4)
    }
  }

  const handleFinish = async () => {
    if (isNew) {
      toast.error('Complete product info first')
      goToStep(1)
      return
    }
    if (!hasVariants) {
      toast.error('Add at least one variant before finishing')
      goToStep(2)
      return
    }
    if (!(await saveBasics({ silent: true }))) return

    setSaving(true)
    try {
      await updateProduct.mutateAsync({ id, ...toProductPayload({ ...form, status: form.status }) })
      toast.success(form.status === 'active' ? 'Product published!' : 'Product saved')
      navigate('/admin/products')
    } catch (err) {
      toast.error(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const finishLabel = form.status === 'active'
    ? 'Publish product'
    : product?.status === 'draft'
      ? 'Create product'
      : 'Save product'

  const title = useMemo(() => {
    if (isNew) return 'Add product'
    return product?.name ? `Edit · ${product.name}` : 'Edit product'
  }, [isNew, product?.name])

  if (!isNew && isLoading && !product) {
    return (
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-8 h-12 w-full" />
        <Skeleton className="mt-6 h-96 w-full rounded-[28px]" />
      </div>
    )
  }

  if (!isNew && !product) {
    return (
      <div className="text-center">
        <p className="text-muted">Product not found.</p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/admin/products">Back to products</Link>
        </Button>
      </div>
    )
  }

  return (
    <div>
      <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
        <Link to="/admin/products">
          <ChevronLeft className="h-4 w-4" />
          Products
        </Link>
      </Button>

      <AdminPageHeader
        title={title}
        description={
          isNew
            ? 'Work through each step — use Save & next to continue. Finish on the last step.'
            : 'Update each section and use Save & next. Finish on the last step to save or publish.'
        }
      />

      <WizardStepper
        steps={WIZARD_STEPS}
        currentStep={step}
        onStepClick={goToStep}
        canGoToStep={canGoToStep}
      />

      {isNew && step > 1 && (
        <div className="mb-6 rounded-2xl border border-gold/20 bg-ivory-3 px-4 py-3 text-sm text-muted">
          Save product info on the first tab before adding variants, images, or certificates.
        </div>
      )}

      {step === 1 && (
        <ProductBasicsStep
          form={form}
          onChange={setForm}
          categories={categories || []}
          brands={brands || []}
          autoSlugFromName={autoSlugFromName}
        />
      )}

      {step === 2 && !isNew && (
        <ProductVariantsStep productId={id} variants={product?.product_variants || []} />
      )}

      {step === 3 && !isNew && (
        <ProductImagesStep productId={id} images={product?.product_images || []} />
      )}

      {step === 4 && !isNew && (
        <div className="space-y-6">
          <ProductCertificatesPanel productId={id} variants={product?.product_variants || []} />
          <div className="rounded-[28px] border border-gold/20 bg-ivory-2 p-6">
            <p className="text-sm font-semibold text-navy">Almost done</p>
            <p className="mt-1 text-sm text-muted">
              {hasVariants
                ? `${variantCount} variant${variantCount === 1 ? '' : 's'} · ${product?.product_images?.length || 0} image(s). Choose a status and click ${finishLabel.toLowerCase()} below.`
                : 'Add at least one variant on the Variants step before finishing.'}
            </p>
          </div>
        </div>
      )}

      <div className="mt-8 flex flex-col gap-4 border-t border-gold/20 pt-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        {step > 1 && (
          <Button variant="outline" disabled={saving} onClick={() => goToStep(step - 1)}>
            Back
          </Button>
        )}

        <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
          {step === 4 && !isNew && (
            <>
              <label className="text-sm font-medium text-navy">Status</label>
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active (live)</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </>
          )}

          {step < 4 ? (
            <Button disabled={saving} onClick={handleSaveAndNext}>
              Save & next
            </Button>
          ) : (
            !isNew && (
              <Button disabled={saving || !hasVariants} onClick={handleFinish}>
                {finishLabel}
              </Button>
            )
          )}
        </div>
      </div>
    </div>
  )
}
