-- dbo.def_inihp  (0 rows)
CREATE TABLE dbo.def_inihp (
  CUSTMR               varchar(7) NOT NULL,
  INVOICE              varchar(7) NOT NULL,
  TRANSCTN             varchar(2) NOT NULL,
  PAYDAT               date NOT NULL,
  PAYAMT               numeric(10,2) NOT NULL,
  DISTAK               numeric(10,2) NOT NULL,
  CHEQUE               varchar(8) NOT NULL,
  DIFCUS               varchar(30) NOT NULL,
  ADJFLA               varchar(3) NOT NULL,
  CHEAMT               numeric(9,2) NOT NULL,
  INVCAMT              numeric(10,2) NOT NULL,
  INVCDAT              date NOT NULL,
  CHECUSTMR            varchar(7) NOT NULL,
  GLACCT               varchar(8) NOT NULL
);