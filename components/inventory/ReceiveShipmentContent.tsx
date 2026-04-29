'use client'

import { generateDoNumber } from '@/lib/inventory'
import { IssueLogPanel } from '@/components/inventory/IssueLogPanel'
import { RestockEntryPanel } from '@/components/inventory/RestockEntryPanel'
import { RestockHistoryPanel } from '@/components/inventory/RestockHistoryPanel'
import type { InventoryItem, RestockBatch, RestockEntryRow, RestockLine, StockTransaction } from '@/lib/inventoryTypes'

type ReceiveShipmentContentProps = {
  doFile: File | null
  doNumber: string
  expandedRestockBatches: string[]
  inventory: InventoryItem[]
  isProcessingRestock: boolean
  isRefreshingTransactions: boolean
  restockBatches: RestockBatch[]
  restockEntries: RestockEntryRow[]
  restockMonthFilter: string
  restockMonthOptions: string[]
  restockView: 'entry' | 'history' | 'issue-log'
  stockTransactionError: string
  stockTransactions: StockTransaction[]
  onAddRow: () => void
  onDeleteRestockBatch: (batch: RestockBatch) => void
  onDeleteRestockLine: (line: RestockLine) => void
  onDoFileChange: (file: File | null) => void
  onDoNumberChange: (value: string) => void
  onExportRestockBatch: (batch: RestockBatch) => void
  onMonthFilterChange: (value: string) => void
  onOpenDoDocument: (receiptUrl: string) => void
  onRefreshTransactions: () => void
  onRemoveRow: (id: number) => void
  onRestockSubmit: () => void
  onToggleBatch: (batchId: string) => void
  onUpdateRow: (id: number, field: string, value: string) => void
}

export function ReceiveShipmentContent({
  doFile,
  doNumber,
  expandedRestockBatches,
  inventory,
  isProcessingRestock,
  isRefreshingTransactions,
  restockBatches,
  restockEntries,
  restockMonthFilter,
  restockMonthOptions,
  restockView,
  stockTransactionError,
  stockTransactions,
  onAddRow,
  onDeleteRestockBatch,
  onDeleteRestockLine,
  onDoFileChange,
  onDoNumberChange,
  onExportRestockBatch,
  onMonthFilterChange,
  onOpenDoDocument,
  onRefreshTransactions,
  onRemoveRow,
  onRestockSubmit,
  onToggleBatch,
  onUpdateRow,
}: ReceiveShipmentContentProps) {
  if (restockView === 'entry') {
    return (
      <RestockEntryPanel
        doNumber={doNumber}
        doFile={doFile}
        inventory={inventory}
        isProcessingRestock={isProcessingRestock}
        restockEntries={restockEntries}
        onAddRow={onAddRow}
        onDoFileChange={onDoFileChange}
        onDoNumberChange={onDoNumberChange}
        onGenerateDoNumber={() => onDoNumberChange(generateDoNumber())}
        onRemoveRow={onRemoveRow}
        onRestockSubmit={onRestockSubmit}
        onUpdateRow={onUpdateRow}
      />
    )
  }

  if (restockView === 'history') {
    return (
      <RestockHistoryPanel
        restockBatches={restockBatches}
        restockMonthFilter={restockMonthFilter}
        restockMonthOptions={restockMonthOptions}
        expandedRestockBatches={expandedRestockBatches}
        onMonthFilterChange={onMonthFilterChange}
        onToggleBatch={onToggleBatch}
        onOpenDoDocument={onOpenDoDocument}
        onExportRestockBatch={onExportRestockBatch}
        onDeleteRestockBatch={onDeleteRestockBatch}
        onDeleteRestockLine={onDeleteRestockLine}
      />
    )
  }

  return (
    <IssueLogPanel
      stockTransactions={stockTransactions}
      stockTransactionError={stockTransactionError}
      isRefreshingTransactions={isRefreshingTransactions}
      onRefreshTransactions={onRefreshTransactions}
    />
  )
}
