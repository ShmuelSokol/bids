-- dbo.contract_release_1_view



/* view contract_release_1_view: add view */


/* view contract_release_1_view: add view */


/* view contract_release_1_view: add view */

/* view contract_release_1_view: add view */


/* view contract_release_1_view: add view */


/* view contract_release_1_view: add view */


/* view contract_release_1_view: add view */


/* view contract_release_1_view: add view */


/* view contract_release_1_view: add view */


/* view contract_release_1_view: add view */


/* view contract_release_1_view: add view */


/* view contract_release_1_view: add view */


/* view contract_release_1_view: add view */


/* view contract_release_1_view: add view */


/* view contract_release_1_view: add view */


/* view contract_release_1_view: add view */


/* view contract_release_1_view: add view */


/* view contract_release_1_view: add view */
CREATE VIEW [dbo].[contract_release_1_view]
AS
SELECT        dbo.k31_tab.c_code_k31 AS c_code_byr, dbo.k31_tab.c_name_k31 AS c_name_byr, dbo.k79_tab.rqmtyp_k79, dbo.k79_tab.cntrct_k79, dbo.k80_tab.rel_no_k80, dbo.k80_tab.reldte_k80, 
                         dbo.k31_tab.idnk31_k31 AS idnk31_byr, dbo.k79_tab.idnk79_k79, dbo.k80_tab.idnk80_k80, dbo.k80_tab.piidno_k80, dbo.k80_tab.docntr_k80
FROM            dbo.k79_tab INNER JOIN
                         dbo.k80_tab ON dbo.k79_tab.idnk79_k79 = dbo.k80_tab.idnk79_k80 INNER JOIN
                         dbo.k31_tab ON dbo.k79_tab.idnk31_k79 = dbo.k31_tab.idnk31_k31


















