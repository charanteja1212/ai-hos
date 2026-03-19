"use client"

import { useFormContext, Controller, type FieldValues, type Path } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface BaseFieldProps<T extends FieldValues> {
  /** Field name — must match the zod schema key */
  name: Path<T>
  /** Display label */
  label: string
  /** Optional placeholder */
  placeholder?: string
  /** Whether the field is required (shows * indicator) */
  required?: boolean
  /** Additional className on the wrapper */
  className?: string
  /** Disabled state */
  disabled?: boolean
}

// ─── Text Input Field ───

interface TextFieldProps<T extends FieldValues> extends BaseFieldProps<T> {
  type?: "text" | "email" | "tel" | "number" | "password" | "date" | "time"
}

export function TextField<T extends FieldValues>({
  name,
  label,
  placeholder,
  required,
  className,
  disabled,
  type = "text",
}: TextFieldProps<T>) {
  const { register, formState: { errors } } = useFormContext<T>()
  const error = errors[name]

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={name} className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <Input
        id={name}
        type={type}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(error && "border-destructive focus-visible:ring-destructive")}
        {...register(name, { valueAsNumber: type === "number" })}
      />
      {error && (
        <p className="text-xs text-destructive">{error.message as string}</p>
      )}
    </div>
  )
}

// ─── Textarea Field ───

interface TextareaFieldProps<T extends FieldValues> extends BaseFieldProps<T> {
  rows?: number
}

export function TextareaField<T extends FieldValues>({
  name,
  label,
  placeholder,
  required,
  className,
  disabled,
  rows = 3,
}: TextareaFieldProps<T>) {
  const { register, formState: { errors } } = useFormContext<T>()
  const error = errors[name]

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={name} className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <Textarea
        id={name}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        className={cn(error && "border-destructive focus-visible:ring-destructive")}
        {...register(name)}
      />
      {error && (
        <p className="text-xs text-destructive">{error.message as string}</p>
      )}
    </div>
  )
}

// ─── Select Field ───

interface SelectFieldProps<T extends FieldValues> extends BaseFieldProps<T> {
  options: { value: string; label: string }[]
}

export function SelectField<T extends FieldValues>({
  name,
  label,
  placeholder = "Select...",
  required,
  className,
  disabled,
  options,
}: SelectFieldProps<T>) {
  const { control, formState: { errors } } = useFormContext<T>()
  const error = errors[name]

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <Select
            value={field.value}
            onValueChange={field.onChange}
            disabled={disabled}
          >
            <SelectTrigger className={cn(error && "border-destructive")}>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      {error && (
        <p className="text-xs text-destructive">{error.message as string}</p>
      )}
    </div>
  )
}
