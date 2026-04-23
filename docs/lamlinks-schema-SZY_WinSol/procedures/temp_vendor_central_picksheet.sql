-- dbo.temp_vendor_central_picksheet



CREATE proc [dbo].[temp_vendor_central_picksheet] as
--this procedure was created for yosef to use for vendor central picksheet printing until abe rice develops a permanent solution

set nocount on;

declare @fpf table (
	[SALORD] [varchar](6) not NULL,
	[PRODCT] [varchar](20) not NULL,
	[ORDQTY] [numeric](13, 2) not NULL,
	[Z_SELCOD] [varchar](4) NULL,
	[Z_SELRAT] [numeric](4, 0) NULL,
	[Z_SELQTY] [numeric](10, 2) NULL,
	[PRODCTDES] [varchar](35) NULL,
	[PRILOC] [varchar](8) NULL,
	[SECLOC] [varchar](8) NULL,
	isPrep bit not null
);


insert into @fpf (SALORD, PRODCT, ORDQTY, Z_SELCOD, Z_SELRAT, Z_SELQTY, PRODCTDES, PRILOC, SECLOC, isPrep)
select SALORD, rtrim(PRODCT), ORDQTY, Z_SELCOD, Z_SELRAT, Z_SELQTY, rtrim(PRODCTDES), rtrim(ltrim(PRILOC)), rtrim(ltrim(SECLOC)), 0
from openquery(szy_winsol_odbc, '
SELECT p.SALORD, p.PRODCT, p.ORDQTY, p.Z_SELCOD, p.Z_SELRAT, p.Z_SELQTY, i.PRODCTDES, w.PRILOC, i.SECLOC
FROM oeoo_1 h, oeoo_p p, ici1 i, icwm w
WHERE (h.CUSTMR=''WA981D'') AND (p.SALORD=h.salord) and p.prodct = i.prodct and i.prodct = w.prodct and w.whse = ''01''
');



--select * from @fpf order by SALORD, PRODCT, Z_SELRAT, Z_SELQTY;

update @fpf set Z_SELCOD = 'EA', Z_SELRAT = 1, Z_SELQTY = ORDQTY where isnull(z_selcod,'') = '';

update a set isPrep = isnull(b.isPrep, 0)
from
	@fpf a
	left join
	(
		select prodct, multiplier, convert(bit, max(convert(int, isprep))) as isprep
		from temp_yosef_prep_not_prep
		group by prodct, multiplier
	) b
	on a.PRODCT = b.PRODCT and a.Z_SELRAT = b.MULTIPLIER;

--select * from @fpf order by SALORD, PRODCT, Z_SELRAT, Z_SELQTY;

select
	SALORD as [Sales Order]
	, a.PRODCT as Product
	, case when a.Z_SELRAT = 1 then 'EA' else convert(varchar(20), a.Z_SELRAT) + '''s' end as [Sold As]
	, convert(int, a.Z_SELQTY) as Quantity
	, a.PRODCTDES as Description
	, a.PRILOC as [Primary Location]
	, a.SECLOC as [Secondary Location]
	, case when a.isPrep = 0 then 'Not prep' else 'Prep' end as [Is Prep]
from
	@fpf a;
--order by
--	a.SALORD, a.PRODCT, a.Z_SELRAT, a.Z_SELQTY;

/*
create table dbo.temp_yosef_prep_not_prep (
	[PRODCT] [varchar](20) not NULL,
	[MULTIPLIER] [numeric](10, 0) not NULL,
	isPrep bit not null
)

--*/