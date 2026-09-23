import { createFormHook } from '@tanstack/react-form'
import dynamic from 'next/dynamic'

import CheckboxField from '@/components/block/form/checkbox-field'
import ComboboxField from '@/components/block/form/combobox-field'
import DatePickerField from '@/components/block/form/date-picker-field'
import DateRangePickerField from '@/components/block/form/date-range-picker-field'
import GalleryUploadField from '@/components/block/form/gallery-upload-field'
import NumberField from '@/components/block/form/number-field'
import PasswordField from '@/components/block/form/password-field'
import RatingField from '@/components/block/form/rating-field'
import SelectField from '@/components/block/form/select-field'
import SelectGroupField from '@/components/block/form/select-group-field'
import SliderField from '@/components/block/form/slider-field'
import SubmitButton from '@/components/block/form/submit'
import SwitchField from '@/components/block/form/switch-field'
import TextField from '@/components/block/form/text-field'
import TextareaField from '@/components/block/form/textarea-field'

import { fieldContext, formContext } from './form-context'

/**
 * `@lexkit/editor` reads React's client-only `createContext` at module scope, so
 * importing it statically drags the whole editor into the RSC graph — where
 * `createContext` does not exist and every page importing `useAppForm` fails to
 * render with "createContext is not a function". Loading the field client-side
 * only keeps it registered without breaking server rendering.
 */
const RichTextEditorField = dynamic(
  () => import('@/components/block/form/rich-text-editor-field'),
  { ssr: false }
)

export const { useAppForm } = createFormHook({
  fieldComponents: {
    TextField,
    NumberField,
    PasswordField,
    SelectField,
    SelectGroupField,
    DatePickerField,
    DateRangePickerField,
    ComboboxField,
    SliderField,
    SwitchField,
    TextareaField,
    RatingField,
    GalleryUploadField,
    RichTextEditorField,
    CheckboxField,
  },
  formComponents: {
    SubmitButton,
  },
  fieldContext,
  formContext,
})
