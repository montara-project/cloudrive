import { AxiosError } from 'axios'
import { toast } from 'sonner'

interface ErrorItem {
  code: string
  field: string
  message: string
  param: string
}

export function throwAxiosError(error: Error) {
  if (error instanceof AxiosError) {
    const errors: ErrorItem[] = error.response?.data?.errors
    const message = error.response?.data?.message

    // console.log('Error', error)
    // console.log('Error Response', error.response)
    // console.log('Error Message', error.response?.data)

    if (errors && errors.length > 0) {
      const errorMessages = errors.map((error) => error.message).join('\n')
      throw new Error(`${message || 'Validation failed'}:\n${errorMessages}`)
    }

    throw new Error(message || 'An error unknown occurred')
  }

  throw new Error(error.message)
}

/** Toast the message extracted by {@link throwAxiosError}. */
export function toastAxiosError(error: unknown) {
  try {
    throwAxiosError(error as Error)
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'An error occurred')
  }
}
