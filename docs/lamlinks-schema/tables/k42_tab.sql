-- dbo.k42_tab  (126 rows)
CREATE TABLE dbo.k42_tab (
  idnk42_k42           int NOT NULL,
  uptime_k42           datetime NOT NULL,
  upname_k42           char(10) NOT NULL,
  idnk39_k42           int NOT NULL,
  idnk41_k42           int NOT NULL,
  addtme_k42           datetime NOT NULL,
  nodelk_k42           char(16) NOT NULL,
  rfquno_k42           int NOT NULL,
  rfq_no_k42           char(32) NOT NULL,
  rrqsta_k42           char(32) NOT NULL,
  rrqtme_k42           datetime NOT NULL,
  itmcnt_k42           int NOT NULL,
  r_note_k42           text(2147483647) NOT NULL,
  c_note_k42           text(2147483647) NOT NULL,
  rrqstp_k42           char(20) NOT NULL,
  PRIMARY KEY (idnk42_k42)
);