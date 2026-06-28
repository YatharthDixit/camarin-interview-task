import { SearchIcon } from './icons';

interface JobFilters {
  search: string;
  status: string; // '' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  flagged: string; // '' | 'true' | 'false'
}

interface DashboardFiltersProps {
  searchInput: string;
  setSearchInput: (value: string) => void;
  filters: JobFilters;
  setStatus: (value: string) => void;
  setFlagged: (value: string) => void;
}

const STATUS_PILLS = [
  { label: 'All',        value: '',            activeClass: 'active' },
  { label: 'Completed',  value: 'COMPLETED',   activeClass: 'active-success' },
  { label: 'Processing', value: 'PROCESSING',  activeClass: 'active-info' },
  { label: 'Pending',    value: 'PENDING',     activeClass: 'active' },
  { label: 'Failed',     value: 'FAILED',      activeClass: 'active-danger' },
];

const CONTENT_PILLS = [
  { label: 'All',     value: '',      activeClass: 'active' },
  { label: 'Safe',    value: 'false', activeClass: 'active-success' },
  { label: 'Flagged', value: 'true',  activeClass: 'active-warning' },
];

export default function DashboardFilters({
  searchInput,
  setSearchInput,
  filters,
  setStatus,
  setFlagged,
}: DashboardFiltersProps) {
  return (
    <div className="filter-bar">
      {/* Search */}
      <div className="search-wrap">
        <SearchIcon className="search-icon" />
        <input
          type="search"
          className="search-input"
          placeholder="Search captions…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      {/* Status + Content pills on one row */}
      <div className="filter-row">
        <div className="filter-pills">
          {STATUS_PILLS.map((pill) => (
            <button
              key={pill.value}
              className={`filter-pill ${filters.status === pill.value ? pill.activeClass : ''}`}
              onClick={() => setStatus(pill.value)}
            >
              {pill.label}
            </button>
          ))}
        </div>

        <div className="filter-divider" />

        <div className="filter-pills">
          {CONTENT_PILLS.map((pill) => (
            <button
              key={pill.value}
              className={`filter-pill ${filters.flagged === pill.value ? pill.activeClass : ''}`}
              onClick={() => setFlagged(pill.value)}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
