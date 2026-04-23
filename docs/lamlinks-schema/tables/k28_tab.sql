-- dbo.k28_tab  (2144448 rows)
CREATE TABLE dbo.k28_tab (
  idnk28_k28           int NOT NULL,
  uptime_k28           datetime NOT NULL,
  upname_k28           char(10) NOT NULL,
  idnk27_k28           int NOT NULL,
  idnsrq_k28           int NOT NULL,
  srqtyp_k28           char(3) NOT NULL,
  jobrtm_k28           datetime NOT NULL,
  jobrst_k28           char(10) NOT NULL,
  ssadds_k28           char(40) NOT NULL,
  jobret_k28           datetime NOT NULL,
  jobtot_k28           datetime NOT NULL,
  jobcnt_k28           int NOT NULL,
  jobstt_k28           datetime NOT NULL,
  PRIMARY KEY (idnk28_k28)
);