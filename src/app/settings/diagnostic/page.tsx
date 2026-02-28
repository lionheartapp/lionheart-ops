'use client'

import { useEffect, useState } from 'react'

export default function DiagnosticPage() {
  const [diagnostics, setDiagnostics] = useState<any>(null)
  const [testResults, setTestResults] = useState<any>(null)

  useEffect(() => {
    // Get localStorage values
    const token = localStorage.getItem('auth-token')
    const orgId = localStorage.getItem('org-id')
    const userName = localStorage.getItem('user-name')
    const userEmail = localStorage.getItem('user-email')
    const userRole = localStorage.getItem('user-role')

    setDiagnostics({
      token: token ? `${token.substring(0, 20)}...` : 'NOT SET',
      orgId: orgId || 'NOT SET',
      userName: userName || 'NOT SET',
      userEmail: userEmail || 'NOT SET',
      userRole: userRole || 'NOT SET',
    })

    // Test permissions API
    if (token) {
      testAPIs(token, orgId)
    }
  }, [])

  const testAPIs = async (token: string, orgId: string | null) => {
    const results: any = {}

    try {
      const permRes = await fetch('/api/auth/permissions', {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      results.permissions = {
        status: permRes.status,
        data: permRes.ok ? await permRes.json() : await permRes.text(),
      }
    } catch (e: any) {
      results.permissions = { error: e.message }
    }

    if (orgId) {
      try {
        const rolesRes = await fetch('/api/settings/roles', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Organization-ID': orgId,
          },
        })
        results.roles = {
          status: rolesRes.status,
          data: rolesRes.ok ? await rolesRes.json() : await rolesRes.text(),
        }
      } catch (e: any) {
        results.roles = { error: e.message }
      }

      try {
        const teamsRes = await fetch('/api/settings/teams', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Organization-ID': orgId,
          },
        })
        results.teams = {
          status: teamsRes.status,
          data: teamsRes.ok ? await teamsRes.json() : await teamsRes.text(),
        }
      } catch (e: any) {
        results.teams = { error: e.message }
      }
    }

    setTestResults(results)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-gray-900">Settings Diagnostic</h1>

        <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-gray-200">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">LocalStorage Values</h2>
          {diagnostics ? (
            <pre className="bg-gray-900 text-green-400 p-4 rounded overflow-x-auto text-sm font-mono">
              {JSON.stringify(diagnostics, null, 2)}
            </pre>
          ) : (
            <p className="text-gray-600">Loading...</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">API Test Results</h2>
          {testResults ? (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2 text-gray-900">Permissions API</h3>
                <pre className="bg-gray-900 text-green-400 p-4 rounded overflow-x-auto text-sm font-mono">
                  {JSON.stringify(testResults.permissions, null, 2)}
                </pre>
              </div>

              {testResults.roles && (
                <div>
                  <h3 className="font-medium mb-2 text-gray-900">Roles API</h3>
                  <pre className="bg-gray-900 text-green-400 p-4 rounded overflow-x-auto text-sm font-mono">
                    {JSON.stringify(testResults.roles, null, 2)}
                  </pre>
                </div>
              )}

              {testResults.teams && (
                <div>
                  <h3 className="font-medium mb-2 text-gray-900">Teams API</h3>
                  <pre className="bg-gray-900 text-green-400 p-4 rounded overflow-x-auto text-sm font-mono">
                    {JSON.stringify(testResults.teams, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-600">Running tests...</p>
          )}
        </div>

        <div className="mt-6">
          <a
            href="/settings"
            className="text-primary-600 hover:text-primary-700 font-medium text-lg"
          >
            ← Back to Settings
          </a>
        </div>
      </div>
    </div>
  )
}
