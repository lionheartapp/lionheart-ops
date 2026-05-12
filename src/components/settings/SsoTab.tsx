'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Copy, Check, ExternalLink, AlertCircle, Shield } from 'lucide-react'
import { fetchApi } from '@/lib/api-client'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Checkbox } from '@/components/ui/Checkbox'

// ─── Types ────────────────────────────────────────────────────────────

interface SamlConnectionData {
  id: string
  enabled: boolean
  idpEntityId: string
  idpSsoUrl: string
  hasCertificate: boolean
  idpCertificate: string
  nameIdFormat: string
  emailAttr: string
  firstNameAttr: string | null
  lastNameAttr: string | null
  autoProvisionUsers: boolean
  defaultRoleId: string | null
  createdAt: string
  updatedAt: string
}

interface SsoSettingsData {
  connection: SamlConnectionData | null
  spEntityId: string
  spAcsUrl: string
  spMetadataUrl: string
}

interface RoleOption {
  id: string
  name: string
}

// ─── Component ────────────────────────────────────────────────────────

export default function SsoTab() {
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [enabled, setEnabled] = useState(false)
  const [idpEntityId, setIdpEntityId] = useState('')
  const [idpSsoUrl, setIdpSsoUrl] = useState('')
  const [idpCertificate, setIdpCertificate] = useState('')
  const [nameIdFormat, setNameIdFormat] = useState('urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress')
  const [emailAttr, setEmailAttr] = useState('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress')
  const [firstNameAttr, setFirstNameAttr] = useState('')
  const [lastNameAttr, setLastNameAttr] = useState('')
  const [autoProvisionUsers, setAutoProvisionUsers] = useState(false)
  const [defaultRoleId, setDefaultRoleId] = useState('')
  const [formDirty, setFormDirty] = useState(false)

  // Fetch SSO config
  const { data, isLoading } = useQuery({
    queryKey: ['sso-settings'],
    queryFn: async () => {
      const result = await fetchApi<SsoSettingsData>('/api/settings/sso')
      return result
    },
    staleTime: 30000,
  })

  // Fetch roles for the default role picker
  const { data: roles } = useQuery({
    queryKey: ['roles-list'],
    queryFn: async () => {
      const result = await fetchApi<RoleOption[]>('/api/settings/roles')
      return result
    },
    staleTime: 60000,
  })

  // Hydrate form from fetched data
  const hydrateForm = (conn: SamlConnectionData | null) => {
    if (conn) {
      setEnabled(conn.enabled)
      setIdpEntityId(conn.idpEntityId)
      setIdpSsoUrl(conn.idpSsoUrl)
      setIdpCertificate(conn.idpCertificate || '')
      setNameIdFormat(conn.nameIdFormat)
      setEmailAttr(conn.emailAttr)
      setFirstNameAttr(conn.firstNameAttr || '')
      setLastNameAttr(conn.lastNameAttr || '')
      setAutoProvisionUsers(conn.autoProvisionUsers)
      setDefaultRoleId(conn.defaultRoleId || '')
    }
    setFormDirty(false)
  }

  // Hydrate on first load
  const [hydrated, setHydrated] = useState(false)
  if (data && !hydrated) {
    hydrateForm(data.connection)
    setHydrated(true)
  }

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      return fetchApi<SsoSettingsData>('/api/settings/sso', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          idpEntityId,
          idpSsoUrl,
          idpCertificate,
          nameIdFormat,
          emailAttr,
          firstNameAttr: firstNameAttr || null,
          lastNameAttr: lastNameAttr || null,
          autoProvisionUsers,
          defaultRoleId: defaultRoleId || null,
        }),
      })
    },
    onSuccess: () => {
      setFormDirty(false)
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['sso-settings'] })
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to save SSO configuration')
    },
  })

  const handleFieldChange = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value)
    setFormDirty(true)
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-sm">
            <KeyRound className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Single Sign-On</h2>
            <p className="text-sm text-slate-500 mt-0.5">Configure SAML 2.0 identity provider</p>
          </div>
        </div>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-sm">
          <KeyRound className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Single Sign-On</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure SAML 2.0 so your staff can sign in with their district identity provider
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* SP Metadata (always visible — admins need these to configure their IdP) */}
      {data && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-900">Service Provider Details</h3>
          </div>
          <p className="text-sm text-slate-500">
            Share these with your identity provider administrator to configure the SAML trust.
          </p>

          <div className="space-y-3">
            <CopyField label="Entity ID (Issuer)" value={data.spEntityId} copied={copied} onCopy={copyToClipboard} />
            <CopyField label="ACS URL (Reply URL)" value={data.spAcsUrl} copied={copied} onCopy={copyToClipboard} />
            <CopyField label="Metadata URL" value={data.spMetadataUrl} copied={copied} onCopy={copyToClipboard} />
          </div>
        </div>
      )}

      {/* IdP Configuration Form */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        <h3 className="text-sm font-semibold text-slate-900">Identity Provider Configuration</h3>

        {/* Enable toggle */}
        <Checkbox
          label="Enable SAML SSO"
          description="When enabled, users will see a 'Sign in with SSO' option on the login page"
          checked={enabled}
          onChange={(e) => handleFieldChange(setEnabled)(e.target.checked)}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">IdP Entity ID</label>
            <Input
              type="text"
              placeholder="https://login.microsoftonline.com/..."
              value={idpEntityId}
              onChange={(e) => handleFieldChange(setIdpEntityId)(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">IdP SSO URL</label>
            <Input
              type="url"
              placeholder="https://login.microsoftonline.com/.../saml2"
              value={idpSsoUrl}
              onChange={(e) => handleFieldChange(setIdpSsoUrl)(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            IdP Signing Certificate (PEM)
          </label>
          <Textarea
            placeholder="-----BEGIN CERTIFICATE-----&#10;MIICmTCCAYECBgF...&#10;-----END CERTIFICATE-----"
            value={idpCertificate}
            onChange={(e) => handleFieldChange(setIdpCertificate)(e.target.value)}
            rows={5}
            className="font-mono text-xs"
          />
          <p className="text-xs text-slate-400 mt-1">
            The X.509 certificate from your IdP, used to verify SAML assertion signatures
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Name ID Format</label>
          <Select
            value={nameIdFormat}
            onChange={(value) => handleFieldChange(setNameIdFormat)(value)}
            options={[
              { value: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress', label: 'Email Address' },
              { value: 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent', label: 'Persistent' },
              { value: 'urn:oasis:names:tc:SAML:2.0:nameid-format:transient', label: 'Transient' },
              { value: 'urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified', label: 'Unspecified' },
            ]}
          />
        </div>
      </div>

      {/* Attribute Mapping */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">Attribute Mapping</h3>
        <p className="text-sm text-slate-500">
          Map SAML assertion attributes to user fields. Defaults work with Azure AD and most IdPs.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Attribute</label>
            <Input
              type="text"
              value={emailAttr}
              onChange={(e) => handleFieldChange(setEmailAttr)(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">First Name Attribute</label>
            <Input
              type="text"
              placeholder="Optional"
              value={firstNameAttr}
              onChange={(e) => handleFieldChange(setFirstNameAttr)(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Last Name Attribute</label>
            <Input
              type="text"
              placeholder="Optional"
              value={lastNameAttr}
              onChange={(e) => handleFieldChange(setLastNameAttr)(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* User Provisioning */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">User Provisioning</h3>

        <Checkbox
          label="Auto-provision users"
          description="Automatically create accounts for new users who sign in via SAML for the first time"
          checked={autoProvisionUsers}
          onChange={(e) => handleFieldChange(setAutoProvisionUsers)(e.target.checked)}
        />

        {autoProvisionUsers && (
          <div className="max-w-xs">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Default Role</label>
            <Select
              value={defaultRoleId}
              onChange={(value) => handleFieldChange(setDefaultRoleId)(value)}
              placeholder="Select a role..."
              options={[
                { value: '', label: 'No default role' },
                ...(roles || []).map((role) => ({ value: role.id, label: role.name })),
              ]}
            />
            <p className="text-xs text-slate-400 mt-1">
              Role assigned to auto-provisioned users. Can be changed later per-user.
            </p>
          </div>
        )}
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={!formDirty || saveMutation.isPending}
          className="px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          {saveMutation.isPending ? 'Saving...' : 'Save Configuration'}
        </button>
        {saveMutation.isSuccess && !formDirty && (
          <span className="text-sm text-green-600 flex items-center gap-1">
            <Check className="w-4 h-4" /> Saved
          </span>
        )}

        {data?.connection?.enabled && (
          <a
            href={`/api/auth/saml/metadata/${data.connection.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View SP Metadata XML
          </a>
        )}
      </div>
    </div>
  )
}

// ─── Copy Field Helper ────────────────────────────────────────────────

function CopyField({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string
  value: string
  copied: string | null
  onCopy: (text: string, label: string) => void
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <code className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-mono truncate">
          {value}
        </code>
        <button
          onClick={() => onCopy(value, label)}
          className="p-2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          title={`Copy ${label}`}
        >
          {copied === label ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  )
}
