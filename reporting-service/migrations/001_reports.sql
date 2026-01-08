CREATE TABLE IF NOT EXISTS reports (
  id CHAR(36) PRIMARY KEY,
  type VARCHAR(64) NOT NULL,
  report_date DATE NOT NULL,
  as_of DATETIME NULL,
  source VARCHAR(16) NOT NULL,
  status VARCHAR(16) NOT NULL,
  artifact_csv_path VARCHAR(512) NULL,
  artifact_json_path VARCHAR(512) NULL,
  checksum_sha256 CHAR(64) NULL,
  error_message TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uniq_type_date (type, report_date),
  KEY idx_type_date (type, report_date)
);
