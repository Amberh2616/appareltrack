'use client';

import { DraftData, DraftTab, Evidence, TableSelection } from '@/lib/types/draft';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import BOMTable from './tables/BOMTable';
import MeasurementTable from './tables/MeasurementTable';
import ConstructionTable from './tables/ConstructionTable';

interface Props {
  draft: DraftData;
  activeTab: DraftTab;
  tableSelection: TableSelection | null;
  filters: {
    issueOnly: boolean;
    missingOnly: boolean;
    lowConfidence: boolean;
  };
  search: string;
  onTabChange: (tab: DraftTab) => void;
  onEvidenceClick: (evidence: Evidence) => void;
  onTableSelectionChange: (selection: TableSelection | null) => void;
  onFiltersChange: (filters: any) => void;
  onSearchChange: (search: string) => void;
}

export default function DraftPane({
  draft,
  activeTab,
  tableSelection,
  filters,
  search,
  onTabChange,
  onEvidenceClick,
  onTableSelectionChange,
  onFiltersChange,
  onSearchChange,
}: Props) {
  const tabs: { key: DraftTab; label: string; count: number }[] = [
    { key: 'bom', label: 'BOM', count: draft.bom.items.length },
    { key: 'measurement', label: 'Measurement', count: draft.measurement.points.length },
    { key: 'construction', label: 'Construction', count: draft.construction.steps.length },
  ];

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Tabs */}
      <div className="border-b">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
              <span className="ml-2 rounded bg-gray-100 px-2 py-0.5 text-xs">
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="border-b bg-gray-50 px-4 py-3">
        <div className="flex gap-2">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filters */}
          <Button
            variant={filters.issueOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() =>
              onFiltersChange({ ...filters, issueOnly: !filters.issueOnly })
            }
          >
            Issues Only
          </Button>
          <Button
            variant={filters.missingOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() =>
              onFiltersChange({ ...filters, missingOnly: !filters.missingOnly })
            }
          >
            Missing
          </Button>
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'bom' && (
          <BOMTable
            items={draft.bom.items}
            issues={draft.bom.issues}
            selection={tableSelection}
            onEvidenceClick={onEvidenceClick}
            onSelectionChange={onTableSelectionChange}
          />
        )}
        {activeTab === 'measurement' && (
          <MeasurementTable
            points={draft.measurement.points}
            issues={draft.measurement.issues}
            selection={tableSelection}
            onEvidenceClick={onEvidenceClick}
            onSelectionChange={onTableSelectionChange}
          />
        )}
        {activeTab === 'construction' && (
          <ConstructionTable
            steps={draft.construction.steps}
            issues={draft.construction.issues}
            selection={tableSelection}
            onEvidenceClick={onEvidenceClick}
            onSelectionChange={onTableSelectionChange}
          />
        )}
      </div>
    </div>
  );
}
