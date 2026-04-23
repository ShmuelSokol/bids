-- dbo.R_INID_2  (1046862 rows)
CREATE TABLE dbo.R_INID_2 (
  INVOICE              char(7) NOT NULL,
  LINEK                char(3) NOT NULL,
  PRODCT               varchar(20),
  SETREM               char(1),
  GENDET               char(1),
  PRIDOC               char(1),
  LIFE                 char(1),
  COMMENT              varchar(30),
  PRIMARY KEY (INVOICE, LINEK)
);