import { createFormHook } from '@tanstack/react-form'
import { lazy, Suspense, type ComponentProps } from 'react'

import CheckboxField from '@/components/block/form/checkbox-field'
import CheckboxGroupField from '@/components/block/form/checkbox-group-field'
import ComboboxField from '@/components/block/form/combobox-field'
import DatePickerField from '@/components/block/form/date-picker-field'
import DateRangePickerField from '@/components/block/form/date-range-picker-field'
import GalleryUploadField from '@/components/block/form/gallery-upload-field'
import NumberField from '@/components/block/form/number-field'
import PasswordField from '@/components/block/form/password-field'
import RadioGroupField from '@/components/block/form/radio-group-field'
import RatingField from '@/components/block/form/rating-field'
import SelectField from '@/components/block/form/select-field'
import SelectGroupField from '@/components/block/form/select-group-field'
import SliderField from '@/components/block/form/slider-field'
import SubmitButton from '@/components/block/form/submit'
import SwitchField from '@/components/block/form/switch-field'
import TextField from '@/components/block/form/text-field'
import TextareaField from '@/components/block/form/textarea-field'

import { fieldContext, formContext } from './form-context'

// Lexical is heavy and only a few forms use it: load the field on first render
// instead of shipping it with every route that builds a form.
const LazyRichTextEditorField = lazy(() => import('@/components/block/form/rich-text-editor-field'))

function RichTextEditorField(props: ComponentProps<typeof LazyRichTextEditorField>) {
  return (
    <Suspense fallback={null}>
      <LazyRichTextEditorField {...props} />
    </Suspense>
  )
}

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
    CheckboxGroupField,
    RadioGroupField,
  },
  formComponents: {
    SubmitButton,
  },
  fieldContext,
  formContext,
})
