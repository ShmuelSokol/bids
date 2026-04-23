-- dbo.k53_tab  (389 rows)
CREATE TABLE dbo.k53_tab (
  idnk53_k53           int NOT NULL,
  uptime_k53           datetime NOT NULL,
  upname_k53           char(10) NOT NULL,
  idnk52_k53           int NOT NULL,
  idnk54_k53           int NOT NULL,
  seq_no_k53           int NOT NULL,
  keyval_k53           char(32) NOT NULL,
  opcode_k53           char(2) NOT NULL,
  exact_k53            char(1) NOT NULL,
  andflg_k53           char(1) NOT NULL,
  notflg_k53           char(1) NOT NULL,
  lprcnt_k53           int NOT NULL,
  rprcnt_k53           int NOT NULL,
  casens_k53           char(1) NOT NULL,
  PRIMARY KEY (idnk53_k53)
);