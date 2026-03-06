'use client'

import { useState } from 'react'
import { Plus, BookOpen } from 'lucide-react'
import { motion } from 'framer-motion'
import DashboardLayout from '@/components/DashboardLayout'
import ModuleGate from '@/components/ModuleGate'
import KnowledgeBaseList from '@/components/maintenance/KnowledgeBaseList'
import KnowledgeBaseSearchBar from '@/components/maintenance/KnowledgeBaseSearchBar'
import KnowledgeBaseArticleEditor from '@/components/maintenance/KnowledgeBaseArticleEditor'
import { fadeInUp, staggerContainer } from '@/lib/animations'

export default function KnowledgeBasePage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)

  return (
    <DashboardLayout>
      <ModuleGate moduleId="maintenance">
        <motion.div
          variants={staggerContainer(0.08, 0)}
          initial="hidden"
          animate="visible"
          className="p-6 space-y-6"
        >
          {/* Page header */}
          <motion.div
            variants={fadeInUp}
            className="flex items-start justify-between gap-4 flex-wrap"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Knowledge Base</h1>
                <p className="text-sm text-gray-500">
                  Equipment guides, SOPs, calculators, and reference articles
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEditorOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              New Article
            </button>
          </motion.div>

          {/* Search bar */}
          <motion.div variants={fadeInUp}>
            <KnowledgeBaseSearchBar value={searchQuery} onSearch={setSearchQuery} />
          </motion.div>

          {/* Article list */}
          <motion.div variants={fadeInUp}>
            <KnowledgeBaseList
              searchQuery={searchQuery}
              onCreateNew={() => setEditorOpen(true)}
            />
          </motion.div>
        </motion.div>

        {/* Article editor drawer */}
        <KnowledgeBaseArticleEditor
          isOpen={editorOpen}
          onClose={() => setEditorOpen(false)}
        />
      </ModuleGate>
    </DashboardLayout>
  )
}
