import { useState, useCallback, forwardRef, useImperativeHandle, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  GripVertical,
  Trash2,
  Columns2,
  Columns,
  Settings2,
  Search,
  Image,
  ImagePlus,
  LayoutGrid,
  ListOrdered,
  Sparkles,
  Send,
  Upload,
} from 'lucide-react'
import { FIELD_CATEGORIES, createField } from '../data/formsData'
import { getFieldIcon } from '../data/formFieldTypes'
import FormBuilderToolbar from './FormBuilderToolbar'
import {
  STOCK_IMAGES,
  HEADER_TEMPLATES,
  LOGO_TEMPLATE,
  loadUserImages,
  addUserImage,
  removeUserImage,
  loadCustomStockImages,
  addCustomStockImage,
  removeCustomStockImage,
  resolveImageRef,
} from '../data/formImagesData'
import { chatWithGemini } from '../services/gemini'
import { getOrgContextForAI } from '../config/orgContext'

function groupFieldsBySection(fields) {
  const sections = []
  const preamble = []
  let i = 0
  while (i < fields.length) {
    if (fields[i].type === 'section') {
      const sectionIndex = i
      const section = fields[i]
      const childFields = []
      i++
      while (i < fields.length && fields[i].type !== 'section') {
        childFields.push(fields[i])
        i++
      }
      sections.push({ section, childFields, sectionIndex })
    } else {
      preamble.push(fields[i])
      i++
    }
  }
  return { preamble, sections }
}

/** Group preamble into rows for 2-col layout: pairs of colSpan-1 sit side-by-side, colSpan-2 or solo gets own row */
function groupPreambleIntoRows(preamble) {
  const rows = []
  let i = 0
  while (i < preamble.length) {
    const field = preamble[i]
    const colSpan = field.colSpan ?? 1
    if (colSpan === 2) {
      rows.push({ fields: [field], startIndex: i })
      i += 1
    } else if (i + 1 < preamble.length && (preamble[i + 1].colSpan ?? 1) === 1) {
      rows.push({ fields: [field, preamble[i + 1]], startIndex: i })
      i += 2
    } else {
      rows.push({ fields: [field], startIndex: i })
      i += 1
    }
  }
  return rows
}

const CONDITION_OPS = [
  { id: 'equals', label: 'equals' },
  { id: 'not_equals', label: 'does not equal' },
  { id: 'contains', label: 'contains' },
  { id: 'is_empty', label: 'is empty' },
  { id: 'is_not_empty', label: 'is not empty' },
]

function filterPaletteItems(search) {
  const q = (search || '').trim().toLowerCase()
  if (!q) return FIELD_CATEGORIES
  return FIELD_CATEGORIES.map((cat) => ({
    ...cat,
    items: cat.items.filter(
      (i) => i.label.toLowerCase().includes(q) || i.id.toLowerCase().includes(q)
    ),
  })).filter((cat) => cat.items.length > 0)
}

const FormBuilder = forwardRef(function FormBuilder(
  { form, onSave, onBack, canEdit, embedded = false },
  ref
) {
  const [title, setTitle] = useState(form.title || '')
  const [description, setDescription] = useState(form.description || '')
  const [descriptionExpanded, setDescriptionExpanded] = useState(!!form.description)
  const [fields, setFields] = useState(() => [...(form.fields || [])])
  const [layout, setLayout] = useState(form.layout || 'default')
  const [formWidth, setFormWidth] = useState(form.formWidth || 'standard')
  const [headerImage, setHeaderImage] = useState(form.headerImage || '')
  const [sideImage, setSideImage] = useState(form.sideImage || '')
  const [showTitle, setShowTitle] = useState(form.showTitle !== false)
  const [steps, setSteps] = useState(() => [...(form.steps || [])])
  const [selectedFieldId, setSelectedFieldId] = useState(null)
  const [rightPanelTab, setRightPanelTab] = useState('settings')
  const [paletteSearch, setPaletteSearch] = useState('')
  const [leftColumnTab, setLeftColumnTab] = useState('components') // 'components' | 'images'
  const [userImages, setUserImages] = useState(loadUserImages)
  const [customStock, setCustomStock] = useState(loadCustomStockImages)
  const [dragOver, setDragOver] = useState(false)
  const [draggingType, setDraggingType] = useState(null)
  const [draggingFieldId, setDraggingFieldId] = useState(null)
  const [dropZoneHover, setDropZoneHover] = useState(null)

  const filteredCategories = filterPaletteItems(paletteSearch)
  const selectedField = fields.find((f) => f.id === selectedFieldId)
  const fieldsBeforeSelected = fields.filter((f) => f.id !== selectedFieldId)

  const addField = useCallback((type, index = fields.length) => {
    const newField = createField(type)
    newField.colSpan = (type === 'section' || type === 'textarea') ? 2 : 1 // 2-col layout; sections/textareas full width
    setFields((prev) => {
      const next = [...prev]
      next.splice(Math.max(0, Math.min(index, next.length)), 0, newField)
      return next
    })
    setSelectedFieldId(newField.id)
  }, [fields.length])

  const updateField = useCallback((id, updates) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)))
  }, [])

  const removeField = useCallback((id) => {
    setFields((prev) => prev.filter((f) => f.id !== id))
    if (selectedFieldId === id) setSelectedFieldId(null)
  }, [selectedFieldId])

  const moveField = useCallback((id, dir) => {
    setFields((prev) => {
      const i = prev.findIndex((f) => f.id === id)
      if (i === -1) return prev
      const j = dir === 'up' ? i - 1 : i + 1
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }, [])

  const moveFieldToIndex = useCallback((fieldId, toIndex) => {
    setFields((prev) => {
      const fromIndex = prev.findIndex((f) => f.id === fieldId)
      if (fromIndex === -1) return prev
      const field = prev[fromIndex]
      const isSection = field.type === 'section'
      let fromEnd = fromIndex
      if (isSection) {
        for (let i = fromIndex + 1; i < prev.length; i++) {
          if (prev[i].type === 'section') break
          fromEnd = i
        }
      }
      if (toIndex >= fromIndex && toIndex <= fromEnd + 1) return prev
      const block = isSection ? prev.slice(fromIndex, fromEnd + 1) : [field]
      const next = prev.filter((_, i) => i < fromIndex || i > fromEnd)
      const insertAt = toIndex > fromEnd
        ? Math.max(0, toIndex - block.length)
        : Math.min(toIndex, next.length)
      next.splice(insertAt, 0, ...block)
      return next
    })
  }, [])

  const setFieldColSpan = useCallback((fieldId, colSpan) => {
    updateField(fieldId, { colSpan })
  }, [updateField])

  const handleSave = () => {
    onSave({
      ...form,
      title: title.trim() || 'Untitled form',
      description: description.trim(),
      fields,
      layout,
      formWidth,
      headerImage,
      sideImage,
      showTitle,
      steps,
    })
    if (!embedded) onBack()
  }

  useImperativeHandle(ref, () => ({ save: handleSave }), [form, title, description, fields, layout, formWidth, headerImage, sideImage, showTitle, steps])

  const handleDragStart = (e, type) => {
    e.dataTransfer.setData('application/x-form-field-type', type)
    e.dataTransfer.effectAllowed = 'copy'
    setDraggingType(type)
  }
  const handleDragEnd = () => {
    setDraggingType(null)
    setDraggingFieldId(null)
  }

  const handleFieldDragStart = (e, fieldId) => {
    e.dataTransfer.setData('application/x-form-field-id', fieldId)
    e.dataTransfer.effectAllowed = 'move'
    e.stopPropagation()
    setDraggingFieldId(fieldId)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = e.dataTransfer.types.includes('application/x-form-field-id') ? 'move' : 'copy'
    setDragOver(true)
  }
  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOver(false)
      setDropZoneHover(null)
    }
  }

  const handleDrop = (e, index) => {
    e.preventDefault()
    setDragOver(false)
    setDropZoneHover(null)
    const fieldId = e.dataTransfer.getData('application/x-form-field-id')
    const type = e.dataTransfer.getData('application/x-form-field-type')
    if (fieldId && canEdit) {
      moveFieldToIndex(fieldId, index)
      setDraggingFieldId(null)
    } else if (type && canEdit) {
      addField(type, index ?? fields.length)
    }
  }

  const handleDropZoneEnter = (idx) => setDropZoneHover(idx)
  const handleDropZoneLeave = () => setDropZoneHover(null)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-full"
    >
      <FormBuilderToolbar onBack={onBack} onSave={handleSave} embedded={embedded} />
      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        {/* Left: Component palette OR Images & Templates */}
        <div className="form-builder-palette glass-card p-4 w-full lg:w-[440px] shrink-0 max-h-[calc(100vh-280px)] lg:max-h-none overflow-hidden flex flex-col">
          <div className="form-builder-palette-tabs flex p-1 rounded-lg bg-zinc-200/80 mb-4 shrink-0">
            <button
              type="button"
              onClick={() => setLeftColumnTab('components')}
              className={`form-builder-palette-tab flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                leftColumnTab === 'components' ? 'form-builder-palette-tab-active bg-white text-zinc-900 shadow-sm' : 'form-builder-palette-tab-inactive text-zinc-600 hover:text-zinc-800 hover:bg-white/50'
              }`}
            >
              Components
            </button>
            <button
              type="button"
              onClick={() => setLeftColumnTab('images')}
              className={`form-builder-palette-tab flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                leftColumnTab === 'images' ? 'form-builder-palette-tab-active bg-white text-zinc-900 shadow-sm' : 'form-builder-palette-tab-inactive text-zinc-600 hover:text-zinc-800 hover:bg-white/50'
              }`}
            >
              Images
            </button>
          </div>
          {leftColumnTab === 'components' ? (
            <>
              <div className="relative mb-4 shrink-0">
                <Search className="form-builder-search-icon absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4" />
                <input
                  type="text"
                  value={paletteSearch}
                  onChange={(e) => setPaletteSearch(e.target.value)}
                  placeholder="Search components"
                  className="form-builder-search w-full pl-8 pr-3 py-2 rounded-lg text-sm"
                />
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-palette space-y-6">
                {filteredCategories.map((cat) => (
                  <div key={cat.id}>
                    <p className="form-builder-section-label text-[10px] font-semibold uppercase tracking-wider mb-3">
                      {cat.label}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {cat.items.map((item) => {
                        const Icon = getFieldIcon(item.id)
                        return (
                          <div
                            key={item.id}
                            draggable={canEdit}
                            onDragStart={(e) => handleDragStart(e, item.id)}
                            onDragEnd={handleDragEnd}
                            className={`form-builder-component-btn flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm cursor-grab active:cursor-grabbing ${
                              !canEdit ? 'opacity-60 cursor-not-allowed' : ''
                            } ${draggingType === item.id ? 'opacity-50' : ''}`}
                            onClick={() => canEdit && addField(item.id)}
                          >
                            <Icon className="form-builder-component-icon w-4 h-4 shrink-0" />
                            <span className="form-builder-component-label">{item.label}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <FormBuilderImagesPanel
              userImages={userImages}
              setUserImages={setUserImages}
              customStock={customStock}
              setCustomStock={setCustomStock}
              canEdit={canEdit}
            />
          )}
        </div>

        {/* Center: Header (full width) + form canvas at selected width */}
        <div className="flex-1 min-w-0 flex flex-col">
          {layout === 'header-cover' && (
            <ImageDropZone
              canEdit={canEdit}
              image={headerImage}
              placeholder="Drop header image here"
              onDrop={(url) => {
                setHeaderImage(url)
                setLayout('header-cover')
              }}
              className="w-full h-32 sm:h-40 rounded-t-xl overflow-hidden mb-0 shrink-0 bg-zinc-200"
            />
          )}
          <div
            className="form-builder-canvas glass-card p-5 flex-1 overflow-auto mx-auto w-full max-w-[1200px]"
          >
            {canEdit ? (
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Form title"
                className="form-builder-form-title w-full text-lg font-semibold bg-transparent border-0 border-b border-transparent hover:border-zinc-200 dark:hover:border-zinc-600 pb-1 focus:ring-0 focus:border-blue-500"
              />
            ) : (
              <h3 className="form-builder-form-title text-lg font-semibold mb-1">
                {title || 'Form title'}
              </h3>
            )}
            {descriptionExpanded ? (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add description"
                rows={2}
                onBlur={() => !description.trim() && setDescriptionExpanded(false)}
                className="form-builder-form-desc w-full mt-1 text-sm bg-transparent border-0 focus:ring-0 resize-none"
                readOnly={!canEdit}
              />
            ) : (
              <button
                type="button"
                onClick={() => canEdit && setDescriptionExpanded(true)}
                className="text-sm text-blue-500 dark:text-blue-400 hover:underline mt-0.5"
              >
                Add description
              </button>
            )}

            <div className="mt-6">
              {fields.length === 0 ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, 0)}
                  className={`min-h-[160px] rounded-lg border-2 border-dashed flex items-center justify-center transition-colors ${
                    dragOver
                      ? 'border-blue-500 bg-blue-500/10 dark:bg-blue-500/20'
                      : 'border-zinc-200 dark:border-zinc-600'
                  }`}
                >
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    Drop here to add a section
                  </span>
                </div>
              ) : (
                <FormFieldsGrid
                  fields={fields}
                  groupFieldsBySection={groupFieldsBySection}
                  selectedFieldId={selectedFieldId}
                  setSelectedFieldId={setSelectedFieldId}
                  draggingFieldId={draggingFieldId}
                  dragOver={dragOver}
                  dropZoneHover={dropZoneHover}
                  handleDragOver={handleDragOver}
                  handleDragLeave={handleDragLeave}
                  handleDrop={handleDrop}
                  handleDropZoneEnter={handleDropZoneEnter}
                  handleDropZoneLeave={handleDropZoneLeave}
                  handleFieldDragStart={handleFieldDragStart}
                  handleDragEnd={handleDragEnd}
                  removeField={removeField}
                  setFieldColSpan={setFieldColSpan}
                  addField={addField}
                  moveFieldToIndex={moveFieldToIndex}
                  updateField={updateField}
                  canEdit={canEdit}
                  fieldPlaceholder={fieldPlaceholder}
                />
              )}
            </div>
          </div>
        </div>

        {/* Right: Settings + AI Help tabs */}
        <div className="form-builder-settings glass-card flex flex-col w-full lg:w-[368px] shrink-0 overflow-hidden p-4">
          <div className="flex p-1 rounded-lg bg-zinc-300/60 shrink-0">
            <button
              type="button"
              onClick={() => setRightPanelTab('settings')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                rightPanelTab === 'settings' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-800'
              }`}
            >
              <Settings2 className="w-4 h-4" />
              Settings
            </button>
            <button
              type="button"
              onClick={() => setRightPanelTab('ai')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                rightPanelTab === 'ai' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-800'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              AI Help
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden pt-4">
            {rightPanelTab === 'settings' ? (
              selectedField ? (
                <FieldSettingsPanel
                  field={selectedField}
                  fieldsBefore={fieldsBeforeSelected}
                  onUpdate={(u) => updateField(selectedField.id, u)}
                  canEdit={canEdit}
                  conditionOps={CONDITION_OPS}
                  icons={ICONS}
                />
              ) : (
                <FormSettingsPanel
                  layout={layout}
                  setLayout={setLayout}
                  headerImage={headerImage}
                  setHeaderImage={setHeaderImage}
                  sideImage={sideImage}
                  setSideImage={setSideImage}
                  showTitle={showTitle}
                  setShowTitle={setShowTitle}
                  steps={steps}
                  setSteps={setSteps}
                  fields={fields}
                  canEdit={canEdit}
                />
              )
            ) : (
              <FormBuilderAIHelp
                form={{ title, description, fields, layout, formWidth, steps, headerImage, sideImage }}
                canEdit={canEdit}
                onFormAction={(action) => {
                  if (action.form) {
                    if (action.form.title != null) setTitle(String(action.form.title))
                    if (action.form.description != null) setDescription(String(action.form.description))
                    if (action.form.layout != null) setLayout(action.form.layout)
                    if (action.form.formWidth != null) setFormWidth(action.form.formWidth)
                    if (action.form.showTitle != null) setShowTitle(!!action.form.showTitle)
                  }
                  if (action.headerImageRef) {
                    const url = resolveImageRef(action.headerImageRef)
                    if (url) {
                      setLayout('header-cover')
                      setHeaderImage(url)
                    }
                  }
                  if (action.sideImageRef) {
                    const url = resolveImageRef(action.sideImageRef)
                    if (url) {
                      setLayout('split')
                      setSideImage(url)
                    }
                  }
                  if (action.addFields?.length) {
                    action.addFields.forEach((d) => {
                      const f = createField(d.type, {
                        label: d.label || 'Untitled',
                        required: !!d.required,
                        placeholder: d.placeholder || '',
                        options: d.options,
                        description: d.description,
                        colSpan: 2,
                      })
                      setFields((prev) => [...prev, f])
                    })
                    setRightPanelTab('settings')
                  }
                  if (action.updateFields?.length) {
                    action.updateFields.forEach(({ index, updates }) => {
                      const field = fields[index]
                      if (field && updates) updateField(field.id, updates)
                    })
                  }
                  if (action.deleteFieldIndices?.length) {
                    const ids = action.deleteFieldIndices
                      .map((i) => fields[i]?.id)
                      .filter(Boolean)
                    ids.forEach((id) => removeField(id))
                  }
                  if (action.form || action.addFields?.length || action.updateFields?.length || action.deleteFieldIndices?.length)
                    setRightPanelTab('settings')
                }}
              />
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
})

export default FormBuilder

const IMAGE_DRAG_TYPE = 'application/x-form-builder-image'

function ImageUploadDropZone({ value, onChange, label = 'Side image' }) {
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  const handleFile = (file) => {
    if (!file?.type?.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => onChange(reader.result)
    reader.readAsDataURL(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const url = e.dataTransfer.getData(IMAGE_DRAG_TYPE)
    if (url) {
      onChange(url)
      return
    }
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes(IMAGE_DRAG_TYPE) || e.dataTransfer.types.includes('Files')) {
      e.dataTransfer.dropEffect = 'copy'
      setDragOver(true)
    }
  }

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false)
  }

  if (value) {
    return (
      <div className="relative rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-600">
        <img src={value} alt="" className="w-full h-24 object-cover" />
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute top-1 right-1 p-1 rounded bg-black/50 text-white text-xs hover:bg-black/70"
        >
          Remove
        </button>
      </div>
    )
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className={`rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
        dragOver
          ? 'border-blue-500 bg-blue-500/10'
          : 'border-zinc-200 dark:border-zinc-600 hover:border-zinc-300 dark:hover:border-zinc-500'
      }`}
    >
      <Upload className="w-8 h-8 mx-auto mb-2 text-zinc-400 dark:text-zinc-500" />
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600"
      >
        <Upload className="w-4 h-4" />
        Upload
      </button>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
        Drop your images here, or click to browse
      </p>
      <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
        PNG, JPG and GIF files
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = '' }}
        className="hidden"
      />
    </div>
  )
}

function ImageDropZone({ canEdit, image, placeholder, onDrop, className = '' }) {
  const [hover, setHover] = useState(false)
  const handleDragOver = (e) => {
    if (!canEdit || !e.dataTransfer.types.includes(IMAGE_DRAG_TYPE)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setHover(true)
  }
  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setHover(false)
  }
  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setHover(false)
    const url = e.dataTransfer.getData(IMAGE_DRAG_TYPE)
    if (url) onDrop(url)
  }
  if (!canEdit) {
    return image ? (
      <div className={className}>
        <img src={image} alt="" className="w-full h-full object-cover" />
      </div>
    ) : null
  }
  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`${className} flex items-center justify-center ${
        hover ? 'ring-2 ring-blue-500 ring-inset' : ''
      }`}
    >
      {image ? (
        <img src={image} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="text-sm text-zinc-500">{placeholder}</span>
      )}
    </div>
  )
}

function FormBuilderImagesPanel({
  userImages,
  setUserImages,
  customStock,
  setCustomStock,
  canEdit,
}) {
  const handleImageDragStart = (e, url) => {
    e.dataTransfer.setData(IMAGE_DRAG_TYPE, url)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file?.type?.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const next = addUserImage(reader.result, file.name.slice(0, 30))
      setUserImages(next)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleRemoveUserImage = (id, e) => {
    e?.stopPropagation?.()
    setUserImages(removeUserImage(id))
  }

  const handleUploadStockImage = (e) => {
    const file = e.target.files?.[0]
    if (!file?.type?.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      setCustomStock(addCustomStockImage(reader.result, file.name.slice(0, 30) || 'Custom'))
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleRemoveCustomStock = (id, e) => {
    e?.stopPropagation?.()
    setCustomStock(removeCustomStockImage(id))
  }

  const allStockImages = [...STOCK_IMAGES, ...customStock]

  return (
    <div className="form-builder-images-panel flex-1 overflow-y-auto scrollbar-palette space-y-6">
      {/* Templates */}
      <div>
        <p className="form-builder-section-label text-[10px] font-semibold uppercase tracking-wider mb-3">
          Templates
        </p>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-zinc-500 mb-2">Logo</p>
            <div
              draggable={canEdit}
              onDragStart={(e) => canEdit && handleImageDragStart(e, LOGO_TEMPLATE.url)}
              className={`w-full rounded-lg border-2 border-dashed border-zinc-200 p-3 hover:border-blue-500 transition-colors bg-zinc-50 cursor-grab active:cursor-grabbing ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <img
                src={LOGO_TEMPLATE.url}
                alt={LOGO_TEMPLATE.name}
                className="h-12 mx-auto object-contain pointer-events-none"
                draggable={false}
              />
              <span className="block mt-1 text-xs text-zinc-500 pointer-events-none">{LOGO_TEMPLATE.name}</span>
            </div>
          </div>
          <div>
            <p className="text-xs text-zinc-500 mb-2">Header banners</p>
            <div className="grid grid-cols-2 gap-2">
              {HEADER_TEMPLATES.map((t) => (
                <div
                  key={t.id}
                  draggable={canEdit}
                  onDragStart={(e) => canEdit && handleImageDragStart(e, t.url)}
                  className={`rounded-lg border border-zinc-200 overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all aspect-[4/1] cursor-grab active:cursor-grabbing ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <img src={t.url} alt={t.name} className="w-full h-full object-cover pointer-events-none" draggable={false} />
                  <span className="sr-only">{t.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stock images */}
      <div>
        <p className="form-builder-section-label text-[10px] font-semibold uppercase tracking-wider mb-3">
          Stock images
        </p>
        {canEdit && (
          <label className="block mb-3">
            <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-300 bg-white text-sm font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer">
              <ImagePlus className="w-4 h-4" />
              Upload image
            </span>
            <input type="file" accept="image/*" onChange={handleUploadStockImage} className="hidden" />
          </label>
        )}
        <div className="grid grid-cols-2 gap-2">
          {allStockImages.map((img) => (
            <div key={img.id} className="relative group">
              <div
                draggable={canEdit}
                onDragStart={(e) => canEdit && handleImageDragStart(e, img.url)}
                className={`w-full relative rounded-lg border border-zinc-200 overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all aspect-[4/3] cursor-grab active:cursor-grabbing ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <img
                  src={img.url}
                  alt={img.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform pointer-events-none"
                  draggable={false}
                  onError={(e) => { e.target.style.background = '#e4e4e7'; e.target.alt = 'Failed to load' }}
                />
                <span className="absolute bottom-1 left-1 right-1 text-xs text-white bg-black/60 rounded px-1 truncate pointer-events-none">
                  {img.name}
                </span>
              </div>
              {canEdit && img.id?.startsWith('custom-') && (
                <button
                  type="button"
                  onClick={(e) => handleRemoveCustomStock(img.id, e)}
                  className="absolute top-1 right-1 p-1 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* My images */}
      <div>
        <p className="form-builder-section-label text-[10px] font-semibold uppercase tracking-wider mb-3">
          My images
        </p>
          <label className="block mb-2">
            <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-300 bg-white text-sm font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer">
            <ImagePlus className="w-4 h-4" />
            Add image
          </span>
          <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
        </label>
        {userImages.length === 0 ? (
          <p className="text-xs text-zinc-500 py-4 text-center border border-dashed border-zinc-200 rounded-lg">
            No images yet. Add some to reuse.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {userImages.map((img) => (
              <div
                key={img.id}
                className="relative rounded-lg border border-zinc-200 overflow-hidden group aspect-[4/3]"
              >
                <div
                  draggable={canEdit}
                  onDragStart={(e) => canEdit && handleImageDragStart(e, img.url)}
                  className={`w-full h-full cursor-grab active:cursor-grabbing ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <img
                    src={img.url}
                    alt={img.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform pointer-events-none"
                    draggable={false}
                  />
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={(e) => handleRemoveUserImage(img.id, e)}
                    className="absolute top-1 right-1 p-1 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Remove"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const FORM_BUILDER_AI_SYSTEM = `You are a helpful assistant for building digital forms. You can edit anything in the form builder based on user requests.

**Capabilities:** Add/edit/delete/reorder fields, change form title/description/layout/width, set header or side images (using templates: template:logo, template:template-header-1, template:template-header-2, template:template-header-3; or stock:0 through stock:6).

Keep replies concise (1–3 sentences). When making changes, output a [FORM_ACTION]...[/FORM_ACTION] block with a JSON object. Supported keys:
- "form": { "title", "description", "layout" ("default"|"header-cover"|"split"), "formWidth" ("narrow"|"standard"|"wide"), "showTitle" }
- "addFields": [ { "type", "label", "required?", "placeholder?", "options?" (array), "description?" } ]
- "updateFields": [ { "index": 0-based, "updates": { "label", "required", "placeholder", "options", "description" } } ]
- "deleteFieldIndices": [ 0-based indices to remove ]
- "headerImageRef": "template:logo" | "template:template-header-1" | "stock:0" (also sets layout to header-cover)
- "sideImageRef": "stock:1" (sets layout to split)

Field types: section, text, textarea, email, phone, number, date, datetime, yesno, dropdown, radio, checklist, checkbox, attachment, image, signature.
For sections use type "section" with "description" for the section subtitle.

Example: "I've updated the form title. [FORM_ACTION]{\"form\":{\"title\":\"Enrollment Form 2025\"}}[/FORM_ACTION]"
Example: "Done. [FORM_ACTION]{\"addFields\":[{\"type\":\"section\",\"label\":\"Contact\"},{\"type\":\"email\",\"label\":\"Email\",\"required\":true}],\"headerImageRef\":\"template:template-header-1\"}[/FORM_ACTION]"`

const VALID_FIELD_TYPES = new Set(['section', 'text', 'textarea', 'number', 'email', 'phone', 'date', 'datetime', 'yesno', 'dropdown', 'radio', 'checklist', 'checkbox', 'attachment', 'image', 'slider', 'signature', 'hidden', 'table', 'profiles'])

function parseFormAction(content) {
  let text = content
  const action = {}

  // [FORM_ACTION] block
  const actionMatch = content.match(/\[FORM_ACTION\]([\s\S]*?)\[\/FORM_ACTION\]/)
  if (actionMatch) {
    text = content.replace(/\[FORM_ACTION\][\s\S]*?\[\/FORM_ACTION\]/, '').trim()
    try {
      const parsed = JSON.parse(actionMatch[1].trim())
      if (parsed.form) action.form = parsed.form
      if (Array.isArray(parsed.addFields) && parsed.addFields.length)
        action.addFields = parsed.addFields.filter((f) => f && typeof f === 'object' && VALID_FIELD_TYPES.has(String(f.type)))
      if (Array.isArray(parsed.updateFields)) action.updateFields = parsed.updateFields
      if (Array.isArray(parsed.deleteFieldIndices)) action.deleteFieldIndices = parsed.deleteFieldIndices
      if (parsed.headerImageRef != null) action.headerImageRef = String(parsed.headerImageRef)
      if (parsed.sideImageRef != null) action.sideImageRef = String(parsed.sideImageRef)
    } catch (_) {}
  }

  // Legacy [FORM_FIELDS] block
  const fieldsMatch = content.match(/\[FORM_FIELDS\]([\s\S]*?)\[\/FORM_FIELDS\]/)
  if (fieldsMatch && !action.addFields) {
    text = text.replace(/\[FORM_FIELDS\][\s\S]*?\[\/FORM_FIELDS\]/, '').trim()
    try {
      const arr = JSON.parse(fieldsMatch[1].trim())
      const list = Array.isArray(arr) ? arr : [arr]
      const fields = list.filter((f) => f && typeof f === 'object' && VALID_FIELD_TYPES.has(String(f.type)))
      if (fields.length) action.addFields = fields
    } catch (_) {}
  }

  return { text: text || 'Done.', action: Object.keys(action).length ? action : null }
}

const RATE_LIMIT_COOLDOWN_SEC = 60

function FormBuilderAIHelp({ form, canEdit, onFormAction }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState(null)
  const [cooldownRemaining, setCooldownRemaining] = useState(0)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  useEffect(() => {
    if (cooldownRemaining <= 0) return
    const id = setInterval(() => {
      setCooldownRemaining((s) => Math.max(0, s - 1))
    }, 1000)
    return () => clearInterval(id)
  }, [cooldownRemaining])

  const formContext = form
    ? `Current form: title="${form.title || 'Untitled'}", description="${(form.description || '').slice(0, 100)}", layout=${form.layout || 'default'}, formWidth=${form.formWidth || 'standard'}, showTitle=${form.showTitle !== false}.
Fields (0-based index): ${(form.fields || []).map((f, i) => `${i}: [${f.type}] "${f.label || 'Untitled'}"`).join(', ') || 'none'}.
Available image refs: template:logo, template:template-header-1, template:template-header-2, template:template-header-3, stock:0 to stock:6.`
    : ''

  const sendMessage = async () => {
    const text = input.trim()
    if (!text) return
    setInput('')
    setError(null)
    const userMsg = { id: `u-${Date.now()}`, role: 'user', content: text }
    setMessages((m) => [...m, userMsg])
    setThinking(true)

    try {
      const reply = await chatWithGemini({
        messages: [
          ...messages.map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: text },
        ],
        systemInstruction: `${getOrgContextForAI()}\n\n${FORM_BUILDER_AI_SYSTEM}\n\n${formContext}`,
      })
      const { text: displayText, action } = parseFormAction(reply)
      if (action && onFormAction) {
        onFormAction(action)
      }
      setMessages((m) => [
        ...m,
        { id: `a-${Date.now()}`, role: 'assistant', content: displayText },
      ])
    } catch (err) {
      const msg = err?.message ?? ''
      const isRateLimit = /rate limit|429/i.test(msg)
      setError(msg?.includes('VITE_GEMINI_API_KEY')
        ? 'Add VITE_GEMINI_API_KEY in .env to use AI help.'
        : msg || 'Something went wrong.')
      if (isRateLimit) setCooldownRemaining(RATE_LIMIT_COOLDOWN_SEC)
    } finally {
      setThinking(false)
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto space-y-3 min-h-0 pb-3 pr-1">
        {messages.length === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 py-4 leading-relaxed">
            Ask anything. Try: &quot;Add name, email, and grade fields&quot;, &quot;Change the title to Enrollment Form&quot;, &quot;Use the blue header template&quot;, or &quot;Delete the second field&quot;.
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[92%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 max-h-[min(50vh,400px)] overflow-y-auto'
              }`}
            >
              <div className="whitespace-pre-wrap break-words">{msg.content}</div>
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex justify-start">
            <div className="rounded-xl px-4 py-2.5 text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
              Thinking…
            </div>
          </div>
        )}
        {error && (
          <p className="text-xs text-amber-600 dark:text-amber-400">{error}</p>
        )}
        <div ref={bottomRef} />
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); sendMessage() }}
        className="flex gap-2 shrink-0 pt-2 border-t border-zinc-200 dark:border-zinc-700"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={cooldownRemaining > 0 ? `Try again in ${cooldownRemaining}s…` : 'Ask about form building…'}
          disabled={thinking || !canEdit || cooldownRemaining > 0}
          className="flex-1 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!input.trim() || thinking || !canEdit || cooldownRemaining > 0}
          className="shrink-0 p-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:pointer-events-none"
          aria-label="Send"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  )
}

function FormSettingsPanel({
  layout,
  setLayout,
  headerImage,
  setHeaderImage,
  sideImage,
  setSideImage,
  showTitle,
  setShowTitle,
  steps,
  setSteps,
  fields,
  canEdit,
}) {
  const createStepsFromSections = () => {
    const sections = fields.filter((f) => f.type === 'section' && f.useAsStep !== false)
    if (sections.length === 0) {
      const firstSection = fields[0]
      setSteps([{ id: `s_${Date.now()}`, title: (firstSection?.type === 'section' ? firstSection?.label : 'Step 1') || 'Step 1', fieldIds: fields.map((f) => f.id) }])
      return
    }
    const newSteps = []
    let currentFieldIds = []
    let stepNum = 1
    let stepTitle = 'Step 1'
    for (const f of fields) {
      if (f.type === 'section' && f.useAsStep !== false) {
        if (currentFieldIds.length) {
          newSteps.push({ id: `s_${Date.now()}_${stepNum}`, title: stepTitle, fieldIds: [...currentFieldIds] })
          stepNum++
        }
        stepTitle = f.label || `Step ${stepNum}`
        currentFieldIds = [f.id]
      } else {
        currentFieldIds.push(f.id)
      }
    }
    if (currentFieldIds.length) {
      newSteps.push({ id: `s_${Date.now()}_${stepNum}`, title: stepTitle, fieldIds: currentFieldIds })
    }
    setSteps(newSteps)
  }

  if (!canEdit) {
    return (
      <div className="form-builder-settings-empty flex flex-col items-center justify-center py-12 text-center">
        <Settings2 className="form-builder-settings-empty-icon w-10 h-10 mb-3" />
        <p className="form-builder-settings-empty-text text-sm">Select a field to edit</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <label className="form-builder-settings-label flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={showTitle}
          onChange={(e) => setShowTitle(e.target.checked)}
          className="rounded border-zinc-300 dark:border-zinc-600"
        />
        <span className="text-sm">Show title on form</span>
      </label>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
          Form layout
        </p>
        <div className="flex flex-col gap-2">
          {[
            { id: 'default', label: 'Default', icon: LayoutGrid },
            { id: 'header-cover', label: 'Header image', icon: Image },
            { id: 'split', label: 'Form + image', icon: ImagePlus },
          ].map((opt) => {
            const Icon = opt.icon
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setLayout(opt.id)}
                className={`flex items-center gap-1.5 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors justify-start ${
                  layout === opt.id
                  ? 'bg-blue-500/15 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {layout === 'header-cover' && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
            Header / cover image
          </p>
          <ImageUploadDropZone value={headerImage} onChange={setHeaderImage} />
        </div>
      )}

      {layout === 'split' && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
            Side image
          </p>
          <ImageUploadDropZone value={sideImage} onChange={setSideImage} />
        </div>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
          Multi-step
        </p>
        {steps.length === 0 ? (
          <button
            type="button"
            onClick={createStepsFromSections}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-300 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
          >
            <ListOrdered className="w-4 h-4" />
            Create steps from sections
          </button>
        ) : (
          <div className="space-y-2">
            {steps.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2 text-sm">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {s.title || `Step ${i + 1}`} ({s.fieldIds?.length ?? 0} fields)
                </span>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setSteps([])}
              className="text-xs text-zinc-500 hover:text-red-500"
            >
              Clear steps (single page)
            </button>
          </div>
        )}
        <p className="text-[11px] text-zinc-500 mt-1">
          Use sections to split the form into steps. Each section starts a new step.
        </p>
      </div>
    </div>
  )
}

function FormFieldsGrid({
  fields,
  groupFieldsBySection,
  selectedFieldId,
  setSelectedFieldId,
  draggingFieldId,
  dragOver,
  dropZoneHover,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleDropZoneEnter,
  handleDropZoneLeave,
  handleFieldDragStart,
  handleDragEnd,
  removeField,
  setFieldColSpan,
  addField,
  moveFieldToIndex,
  updateField,
  canEdit,
  fieldPlaceholder,
}) {
  const { preamble, sections } = groupFieldsBySection(fields)
  let currentIndex = 0

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={(e) => {
        // Catch drops that land on FieldCards or other non-DropZone elements (DropZones stopPropagation)
        const index = dropZoneHover ?? fields.length
        handleDrop(e, index)
      }}
      className="min-h-0 space-y-6"
    >
      {/* Preamble: fields before first section – grouped into rows so colSpan-1 pairs sit side-by-side */}
      {preamble.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
          {groupPreambleIntoRows(preamble).flatMap((row) => {
            const { fields: rowFields, startIndex } = row
            const endIndex = startIndex + rowFields.length
            const rowContent = []
            // Drop zone above row
            rowContent.push(
              <DropZone
                key={`dz-${startIndex}`}
                isActive={dropZoneHover === startIndex || (dragOver && !draggingFieldId)}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, startIndex)}
                onDragEnter={() => handleDropZoneEnter(startIndex)}
                onDropZoneLeave={handleDropZoneLeave}
              />
            )
            // Fields in row – side-by-side when 2 colSpan-1 fields
            rowFields.forEach((field, j) => {
              const colSpan = field.colSpan ?? 1
              const isDragging = draggingFieldId === field.id
              rowContent.push(
                <FieldCard
                  key={field.id}
                  field={field}
                  colSpan={colSpan}
                  isSelected={selectedFieldId === field.id}
                  isDragging={isDragging}
                  canEdit={canEdit}
                  onSelect={() => setSelectedFieldId(field.id)}
                  onRemove={() => removeField(field.id)}
                  onDragStart={(e) => handleFieldDragStart(e, field.id)}
                  onDragEnd={handleDragEnd}
                  onColSpanChange={(span) => setFieldColSpan(field.id, span)}
                  fieldPlaceholder={fieldPlaceholder}
                />
              )
            })
            // If solo colSpan-1 field, add drop zone in right cell for "add beside"
            if (rowFields.length === 1 && (rowFields[0].colSpan ?? 1) === 1) {
              rowContent.push(
                <DropZone
                  key={`dz-mid-${startIndex}`}
                  inline
                  isActive={dropZoneHover === startIndex + 1 || (dragOver && !draggingFieldId)}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, startIndex + 1)}
                  onDragEnter={() => handleDropZoneEnter(startIndex + 1)}
                  onDropZoneLeave={handleDropZoneLeave}
                />
              )
            }
            return rowContent
          })}
          <DropZone
            key="dz-preamble-end"
            isActive={dropZoneHover === preamble.length || (dragOver && !draggingFieldId)}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, preamble.length)}
            onDragEnter={() => handleDropZoneEnter(preamble.length)}
            onDropZoneLeave={handleDropZoneLeave}
            last
          />
        </div>
      )}
      {/* Drop zone before first section (when no preamble) */}
      {preamble.length === 0 && sections.length > 0 && (
        <DropZone
          key="dz-before-first-section"
          isActive={dropZoneHover === 0 || (dragOver && !draggingFieldId)}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 0)}
          onDragEnter={() => handleDropZoneEnter(0)}
          onDropZoneLeave={handleDropZoneLeave}
        />
      )}
      {/* Sections as full-width containers with drop zones */}
      {sections.map(({ section, childFields, sectionIndex }) => {
        const sectionStartIdx = sectionIndex
        const firstDropIdx = sectionStartIdx + 1
        currentIndex = sectionStartIdx + 1 + childFields.length
        return (
          <SectionContainer
            key={section.id}
            section={section}
            childFields={childFields}
            sectionStartIdx={sectionStartIdx}
            selectedFieldId={selectedFieldId}
            setSelectedFieldId={setSelectedFieldId}
            draggingFieldId={draggingFieldId}
            dragOver={dragOver}
            dropZoneHover={dropZoneHover}
            handleDragOver={handleDragOver}
            handleDragLeave={handleDragLeave}
            handleDrop={handleDrop}
            handleDropZoneEnter={handleDropZoneEnter}
            handleDropZoneLeave={handleDropZoneLeave}
            handleFieldDragStart={handleFieldDragStart}
            handleDragEnd={handleDragEnd}
            removeField={removeField}
            setFieldColSpan={setFieldColSpan}
            updateField={updateField}
            canEdit={canEdit}
            fieldPlaceholder={fieldPlaceholder}
          />
        )
      })}
      {/* Drop zone after last section (or after preamble if no sections) */}
      {sections.length > 0 && (
        <DropZone
          key="dz-final"
          isActive={dropZoneHover === fields.length || (dragOver && !draggingFieldId)}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, fields.length)}
          onDragEnter={() => handleDropZoneEnter(fields.length)}
          onDropZoneLeave={handleDropZoneLeave}
          last
        />
      )}
    </div>
  )
}

function SectionContainer({
  section,
  childFields,
  sectionStartIdx,
  selectedFieldId,
  setSelectedFieldId,
  draggingFieldId,
  dragOver,
  dropZoneHover,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleDropZoneEnter,
  handleDropZoneLeave,
  handleFieldDragStart,
  handleDragEnd,
  removeField,
  setFieldColSpan,
  updateField,
  canEdit,
  fieldPlaceholder,
}) {
  const bgStyle = {}
  if (section.sectionBackgroundImage) {
    bgStyle.backgroundImage = `url(${section.sectionBackgroundImage})`
    bgStyle.backgroundSize = 'cover'
    bgStyle.backgroundPosition = 'center'
  }
  if (section.sectionBackgroundColor) {
    bgStyle.backgroundColor = section.sectionBackgroundColor
  }
  const isEmpty = childFields.length === 0
  const firstDropIdx = sectionStartIdx + 1

  return (
    <div
      draggable={canEdit}
      onDragStart={(e) => canEdit && handleFieldDragStart(e, section.id)}
      onDragEnd={handleDragEnd}
      className={`form-builder-section-container rounded-xl overflow-hidden ${draggingFieldId === section.id ? 'opacity-40' : ''}`}
      style={Object.keys(bgStyle).length ? bgStyle : undefined}
    >
      <div
        onClick={() => setSelectedFieldId(section.id)}
        className={`form-builder-section-header flex items-center justify-between gap-2 px-4 py-3 border-b cursor-pointer ${
          selectedFieldId === section.id ? 'form-builder-section-header-selected' : 'form-builder-section-header-default'
        }`}
      >
        <div className="flex-1 min-w-0">
          <span className="form-builder-section-title font-medium">{section.label || 'Section'}</span>
          {section.description && (
            <p className="form-builder-section-desc text-xs mt-0.5">{section.description}</p>
          )}
        </div>
        {canEdit && (
          <div className="flex shrink-0 gap-1 cursor-grab active:cursor-grabbing" onMouseDown={(e) => e.stopPropagation()}>
            <GripVertical className="form-builder-section-icon w-4 h-4" title="Drag to move section" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeField(section.id) }}
              className="form-builder-section-icon p-1 hover:text-red-600"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`min-h-[120px] p-4 ${isEmpty ? 'flex flex-col' : ''}`}
      >
        {isEmpty ? (
          <div
            onDrop={(e) => handleDrop(e, firstDropIdx)}
            onDragEnter={() => handleDropZoneEnter(firstDropIdx)}
            onDragLeave={handleDropZoneLeave}
            className={`form-builder-section-drop-zone flex-1 min-h-[100px] rounded-lg border-2 border-dashed flex items-center justify-center transition-colors ${
              dropZoneHover === firstDropIdx || (dragOver && !draggingFieldId)
                ? 'form-builder-section-drop-zone-active'
                : 'form-builder-section-drop-zone-default'
            }`}
          >
            <span className="form-builder-section-drop-zone-text text-sm">
              Drop fields here to add to this section
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
            {groupPreambleIntoRows(childFields).flatMap((row) => {
              const { fields: rowFields, startIndex } = row
              const baseIdx = sectionStartIdx + 1
              const insertIdx = baseIdx + startIndex
              const endIdx = baseIdx + startIndex + rowFields.length
              const rowContent = []
              rowContent.push(
                <DropZone
                  key={`dz-s${section.id}-${insertIdx}`}
                  isActive={dropZoneHover === insertIdx || (dragOver && !draggingFieldId)}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, insertIdx)}
                  onDragEnter={() => handleDropZoneEnter(insertIdx)}
                  onDropZoneLeave={handleDropZoneLeave}
                />
              )
              rowFields.forEach((field) => {
                const colSpan = field.colSpan ?? 1
                const isDragging = draggingFieldId === field.id
                rowContent.push(
                  <FieldCard
                    key={field.id}
                    field={field}
                    colSpan={colSpan}
                    isSelected={selectedFieldId === field.id}
                    isDragging={isDragging}
                    canEdit={canEdit}
                    onSelect={() => setSelectedFieldId(field.id)}
                    onRemove={() => removeField(field.id)}
                    onDragStart={(e) => handleFieldDragStart(e, field.id)}
                    onDragEnd={handleDragEnd}
                    onColSpanChange={(span) => setFieldColSpan(field.id, span)}
                    fieldPlaceholder={fieldPlaceholder}
                  />
                )
              })
              if (rowFields.length === 1 && (rowFields[0].colSpan ?? 1) === 1) {
                rowContent.push(
                  <DropZone
                    key={`dz-s${section.id}-mid-${insertIdx}`}
                    inline
                    isActive={dropZoneHover === insertIdx + 1 || (dragOver && !draggingFieldId)}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, insertIdx + 1)}
                    onDragEnter={() => handleDropZoneEnter(insertIdx + 1)}
                    onDropZoneLeave={handleDropZoneLeave}
                  />
                )
              }
              return rowContent
            })}
            <DropZone
              key={`dz-s${section.id}-end`}
              isActive={dropZoneHover === sectionStartIdx + 1 + childFields.length || (dragOver && !draggingFieldId)}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, sectionStartIdx + 1 + childFields.length)}
              onDragEnter={() => handleDropZoneEnter(sectionStartIdx + 1 + childFields.length)}
              onDropZoneLeave={handleDropZoneLeave}
              last
            />
          </div>
        )}
      </div>
    </div>
  )
}

function DropZone({
  isActive,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnter,
  onDropZoneLeave,
  last,
  inline,
}) {
  return (
    <div
      className={`${inline ? 'col-span-1' : 'col-span-2'} min-h-[28px] -my-0.5 rounded transition-colors flex items-center justify-center ${
        isActive ? 'bg-blue-500/20 ring-1 ring-blue-500/50' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
      } ${last ? 'min-h-[72px] my-2' : 'py-1'}`}
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onDragOver(e)
      }}
      onDragLeave={(e) => {
        onDragLeave(e)
        onDropZoneLeave()
      }}
      onDrop={(e) => {
        e.stopPropagation()
        onDrop(e)
      }}
      onDragEnter={(e) => {
        e.stopPropagation()
        onDragEnter()
      }}
    >
      {isActive && (
        <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
          {last ? 'Drop here to add' : inline ? 'Drop to add beside' : 'Drop to reorder'}
        </span>
      )}
    </div>
  )
}

function FieldCard({
  field,
  colSpan,
  isSelected,
  isDragging,
  canEdit,
  onSelect,
  onRemove,
  onDragStart,
  onDragEnd,
  onColSpanChange,
  fieldPlaceholder,
}) {
  const isSection = field.type === 'section'
  const canChangeSpan = canEdit && !isSection

  return (
    <div
      draggable={canEdit}
      onDragStart={(e) => canEdit && onDragStart(e)}
      onDragEnd={onDragEnd}
      className={`flex items-stretch ${isDragging ? 'opacity-40' : ''} ${colSpan === 2 ? 'col-span-2' : 'col-span-1'}`}
    >
      <div
        onClick={onSelect}
        className={`flex-1 flex items-start gap-2 p-3 rounded-lg border transition-colors cursor-pointer min-w-0 ${
          isSelected
            ? 'border-blue-500 bg-blue-500/10 dark:bg-blue-500/20'
            : 'border-zinc-200 dark:border-zinc-600 hover:border-zinc-300'
        }`}
      >
        {canEdit && !isSection && (
          <div
            className="flex shrink-0 gap-0.5 cursor-grab active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div
              className="p-0.5 text-zinc-400 hover:text-zinc-600"
              title="Drag to reorder"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove() }}
              className="p-0.5 text-zinc-400 hover:text-red-500"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <div className="flex-1 text-left min-w-0">
          {isSection ? (
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {field.label || 'Section'}
            </span>
          ) : (
            <>
              <span className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-0.5">
                {(field.label || 'Untitled') + (field.required ? '*' : '')}
              </span>
              <span className="text-sm text-zinc-400 dark:text-zinc-500">
                {field.placeholder || fieldPlaceholder(field)}
              </span>
            </>
          )}
        </div>
        {canChangeSpan && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onColSpanChange(colSpan === 2 ? 1 : 2)
            }}
            className="shrink-0 p-1 rounded text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-700"
            title={colSpan === 2 ? 'Shrink to 1 column' : 'Expand to 2 columns'}
          >
            {colSpan === 2 ? (
              <Columns className="w-4 h-4" />
            ) : (
              <Columns2 className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
    </div>
  )
}

function fieldPlaceholder(field) {
  const map = {
    text: 'Text',
    textarea: 'Long text',
    email: 'email@example.com',
    phone: 'Phone number',
    number: '0',
    date: 'dd/mm/yyyy',
    datetime: 'Date and time',
    yesno: 'Yes or No',
    dropdown: 'Select...',
    checkbox: 'Checkbox',
    checklist: 'Checklist',
    radio: 'Choose one',
    profiles: 'Select user',
    attachment: 'Attach files',
    image: 'Upload image',
    slider: 'Slider',
    signature: 'Sign here',
  }
  return map[field.type] || ''
}

function FieldSettingsPanel({
  field,
  fieldsBefore,
  onUpdate,
  canEdit,
  conditionOps,
  icons: ICONS,
}) {
  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <Settings2 className="form-builder-settings-icon w-4 h-4" />
        <span className="form-builder-settings-title font-medium">Field settings</span>
      </div>
      <div className="space-y-4">
        <div>
          <label className="form-builder-settings-label block text-xs font-medium mb-1">
            Label
          </label>
          <input
            type="text"
            value={field.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            className="form-builder-settings-input w-full px-3 py-2 rounded-lg border text-sm"
            readOnly={!canEdit}
          />
        </div>
        {field.type === 'section' && (
          <>
            <div>
              <label className="form-builder-settings-label block text-xs font-medium mb-1">
                Description
              </label>
              <textarea
                value={field.description || ''}
                onChange={(e) => onUpdate({ description: e.target.value })}
                rows={2}
                className="form-builder-settings-input w-full px-3 py-2 rounded-lg border text-sm"
                readOnly={!canEdit}
              />
            </div>
            <div>
              <label className="form-builder-settings-label block text-xs font-medium mb-1">
                Background color
              </label>
              <div className="flex gap-2 flex-wrap">
                {['', '#f3f4f6', '#e5e7eb', '#dbeafe', '#fce7f3', '#fef3c7'].map((color) => (
                  <button
                    key={color || 'none'}
                    type="button"
                    onClick={() => onUpdate({ sectionBackgroundColor: color })}
                    className={`form-builder-settings-color-swatch w-8 h-8 rounded-lg border-2 shrink-0 ${
                      (field.sectionBackgroundColor || '') === color
                        ? 'form-builder-settings-color-swatch-selected'
                        : 'form-builder-settings-color-swatch-default'
                    }`}
                    style={color ? { backgroundColor: color } : {}}
                    title={color ? color : 'None'}
                  >
                    {!color && (
                      <span className="form-builder-settings-color-none text-[10px]">—</span>
                    )}
                  </button>
                ))}
                <input
                  type="color"
                  value={
                    field.sectionBackgroundColor?.startsWith('#') && field.sectionBackgroundColor.length === 7
                      ? field.sectionBackgroundColor
                      : '#e5e7eb'
                  }
                  onChange={(e) => onUpdate({ sectionBackgroundColor: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer border border-zinc-200"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                Background image
              </label>
              <label className="block cursor-pointer">
                <span className="form-builder-settings-btn inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium">
                  {field.sectionBackgroundImage ? 'Change image' : 'Add background image'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file?.type?.startsWith('image/')) return
                    const reader = new FileReader()
                    reader.onload = () => onUpdate({ sectionBackgroundImage: reader.result })
                    reader.readAsDataURL(file)
                    e.target.value = ''
                  }}
                  className="hidden"
                />
              </label>
              {field.sectionBackgroundImage && (
                <button
                  type="button"
                  onClick={() => onUpdate({ sectionBackgroundImage: '' })}
                  className="mt-2 text-xs text-zinc-500 hover:text-red-500"
                >
                  Remove image
                </button>
              )}
            </div>
            <label className="form-builder-settings-label flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!field.useAsStep}
                onChange={(e) => onUpdate({ useAsStep: e.target.checked })}
                disabled={!canEdit}
                className="rounded border-zinc-300 dark:border-zinc-600"
              />
              <span className="text-sm">
                Use as step in multi-step form
              </span>
            </label>
          </>
        )}
        {!['hidden', 'section'].includes(field.type) && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!field.required}
              onChange={(e) => onUpdate({ required: e.target.checked })}
              disabled={!canEdit}
              className="rounded border-zinc-300 dark:border-zinc-600"
            />
            <span className="text-sm text-zinc-700 dark:text-zinc-300">Required</span>
          </label>
        )}
        {!['hidden', 'section'].includes(field.type) && (
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
              Width
            </label>
            <div className="inline-flex p-1 rounded-lg bg-zinc-300/60">
              <button
                type="button"
                onClick={() => onUpdate({ colSpan: 1 })}
                disabled={!canEdit}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  (field.colSpan ?? 1) === 1
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-600 hover:text-zinc-800'
                }`}
              >
                <Columns className="w-4 h-4" />
                1 column
              </button>
              <button
                type="button"
                onClick={() => onUpdate({ colSpan: 2 })}
                disabled={!canEdit}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  (field.colSpan ?? 1) === 2
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-600 hover:text-zinc-800'
                }`}
              >
                <Columns2 className="w-4 h-4" />
                2 columns
              </button>
            </div>
          </div>
        )}
        {['text', 'textarea', 'email', 'phone', 'number', 'date', 'datetime'].includes(field.type) && (
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
              Placeholder
            </label>
            <input
              type="text"
              value={field.placeholder || ''}
              onChange={(e) => onUpdate({ placeholder: e.target.value })}
              placeholder={field.type === 'date' ? 'dd/mm/yyyy' : ''}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm"
              readOnly={!canEdit}
            />
          </div>
        )}
        {['dropdown', 'radio', 'yesno', 'checklist'].includes(field.type) && (
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
              Options (one per line)
            </label>
            <textarea
              value={(field.options || []).join('\n')}
              onChange={(e) =>
                onUpdate({
                  options: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
                })
              }
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm font-mono"
              readOnly={!canEdit}
            />
          </div>
        )}
        {['text', 'textarea'].includes(field.type) && (
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
              Max length
            </label>
            <input
              type="number"
              min={1}
              value={field.validation?.maxLength ?? ''}
              onChange={(e) => {
                const v = e.target.value ? parseInt(e.target.value, 10) : null
                onUpdate({ validation: { ...field.validation, maxLength: v } })
              }}
              placeholder="No limit"
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm"
              readOnly={!canEdit}
            />
          </div>
        )}
        {field.type === 'slider' && (
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                Min
              </label>
              <input
                type="number"
                value={field.validation?.min ?? 0}
                onChange={(e) =>
                  onUpdate({ validation: { ...field.validation, min: parseInt(e.target.value, 10) || 0 } })
                }
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm"
                readOnly={!canEdit}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                Max
              </label>
              <input
                type="number"
                value={field.validation?.max ?? 100}
                onChange={(e) =>
                  onUpdate({ validation: { ...field.validation, max: parseInt(e.target.value, 10) || 100 } })
                }
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm"
                readOnly={!canEdit}
              />
            </div>
          </div>
        )}
        {field.type !== 'hidden' && fieldsBefore.filter((f) => f.type !== 'section').length > 0 && (
          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-600">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">Show when</p>
            <div className="space-y-2">
              <select
                value={field.conditional?.fieldId ?? ''}
                onChange={(e) =>
                  onUpdate({
                    conditional: e.target.value
                      ? {
                          ...field.conditional,
                          fieldId: e.target.value,
                          operator: field.conditional?.operator || 'equals',
                          value: field.conditional?.value ?? '',
                        }
                      : null,
                  })
                }
                disabled={!canEdit}
                className="select-arrow-padded w-full pl-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm"
              >
                <option value="">Always show</option>
                {fieldsBefore.filter((f) => f.type !== 'section').map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label || f.id}
                  </option>
                ))}
              </select>
              {(field.conditional?.fieldId ?? '') && (
                <>
                  <select
                    value={field.conditional?.operator ?? 'equals'}
                    onChange={(e) =>
                      onUpdate({ conditional: { ...field.conditional, operator: e.target.value } })
                    }
                    disabled={!canEdit}
                    className="select-arrow-padded w-full pl-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm"
                  >
                    {conditionOps.map((op) => (
                      <option key={op.id} value={op.id}>
                        {op.label}
                      </option>
                    ))}
                  </select>
                  {!['is_empty', 'is_not_empty'].includes(field.conditional?.operator ?? '') && (
                    <input
                      type="text"
                      value={field.conditional?.value ?? ''}
                      onChange={(e) =>
                        onUpdate({ conditional: { ...field.conditional, value: e.target.value } })
                      }
                      placeholder="Value"
                      className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm"
                      readOnly={!canEdit}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
