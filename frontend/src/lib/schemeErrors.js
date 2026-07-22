const DEFAULT_SCHEME_ERROR_MESSAGE = 'Something went wrong. Please try again.'

const SCHEME_ERROR_MESSAGES = {
  already_enrolled: 'You are already enrolled in this scheme.',
  forbidden: 'You do not have permission to perform this action.',
  installment_not_pending: 'This installment is not pending for payment.',
  installment_not_payable: 'This installment is not available for payment.',
  installment_not_found: 'Installment not found.',
  installment_amount_mismatch: 'Submitted amount does not match the installment amount.',
  installment_cancelled: 'Cancelled installments cannot be paid.',
  installment_already_paid: 'This installment is already paid.',
  idempotency_conflict: 'This installment is already paid with different payment details.',
  scheme_txn_ref_reused: 'This transaction reference was already used for another installment.',
  transaction_ref_required: 'A transaction reference is required for bank transfer and card.',
  invalid_installment_status: 'This installment status is not valid for this action.',
  enrollment_not_active: 'This scheme enrollment is not active.',
  enrollment_inactive: 'This scheme enrollment is not active.',
  scheme_enrollment_not_active: 'This scheme enrollment is not active.',
  scheme_not_found: 'Scheme not found.',
  enrollment_not_found: 'Scheme enrollment not found.',
  cannot_cancel_completed: 'Completed schemes cannot be cancelled.',
  cannot_reactivate_cancelled_scheme: 'Cancelled schemes cannot be reactivated.',
  completed_scheme_cannot_transition: 'Completed schemes cannot be changed.',
  invalid_scheme_status: 'Invalid scheme status.',
  invalid_enrollment_update: 'Only cancellation is supported for this enrollment update.',
  maturity_not_reached: 'This scheme has not reached maturity yet.',
  installments_unpaid: 'All installments must be paid before completing this scheme.',
  scheme_total_paid_insufficient:
    'Total paid amount is not sufficient to complete this scheme.',
  invalid_payout_amount: 'Enter a valid payout amount.',
  scheme_payment_not_configured: 'Online scheme payment is not configured yet.',
  scheme_not_matured: 'This scheme has not reached maturity yet.',
  scheme_installments_not_completed: 'All installments must be paid before completing this scheme.',
  payout_exceeds_expected_amount: 'Payout amount exceeds the allowed scheme value.',
  unauthorized: 'You do not have permission to perform this action.',
  validation_error: 'Please check the form values and try again.',
  payment_url_missing:
    'Online installment payment is not available yet. Please pay at store or contact the store.',
}

function extractSchemeCode(input) {
  if (!input) return null

  if (typeof input === 'string') {
    return input.trim() || null
  }

  if (typeof input === 'object') {
    if (typeof input.code === 'string' && input.code.trim()) return input.code.trim()
    if (typeof input.error === 'string' && input.error.trim()) return input.error.trim()
    if (typeof input.message === 'string' && input.message.trim()) return input.message.trim()
    if (typeof input.hint === 'string' && input.hint.trim()) return input.hint.trim()
    if (typeof input.details === 'string' && input.details.trim()) return input.details.trim()
  }

  return null
}

export function formatSchemeError(input) {
  const raw = extractSchemeCode(input)
  if (!raw) return DEFAULT_SCHEME_ERROR_MESSAGE

  const normalized = raw.toLowerCase().trim()
  if (SCHEME_ERROR_MESSAGES[normalized]) {
    return SCHEME_ERROR_MESSAGES[normalized]
  }

  // Try to map if backend embeds code text in larger message content.
  const mappedByIncludes = Object.entries(SCHEME_ERROR_MESSAGES).find(([key]) =>
    normalized.includes(key)
  )
  if (mappedByIncludes) return mappedByIncludes[1]

  return DEFAULT_SCHEME_ERROR_MESSAGE
}
