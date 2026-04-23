-- dbo.rfq_1_view



/* view rfq_1_view: add view */


/* view rfq_1_view: add view */


/* view rfq_1_view: add view */

/* view rfq_1_view: add view */


/* view rfq_1_view: add view */


/* view rfq_1_view: add view */


/* view rfq_1_view: add view */
/* view rfq_1_view: add view 
 view rfq_1_view: add view 
 view rfq_1_view: add view 
 view rfq_1_view: add view 
 view rfq_1_view: add view 
 view rfq_1_view: add view 
 view rfq_1_view: add view 
 view rfq_1_view: add view */
CREATE VIEW [dbo].[rfq_1_view]
AS
SELECT        dbo.k39_tab.s_code_k39, dbo.k39_tab.s_attn_k39, dbo.k39_tab.s_phon_k39, dbo.k39_tab.s_faxn_k39, dbo.k39_tab.s_emal_k39, dbo.k39_tab.rs_typ_k39, dbo.k39_tab.dwgtyp_k39, dbo.k39_tab.review_k39, 
                         dbo.k39_tab.idnk36_k39, dbo.k42_tab.rfq_no_k42, dbo.k42_tab.rrqsta_k42, dbo.k42_tab.itmcnt_k42, dbo.k39_tab.idnk12_k39 AS idnk12_k12, dbo.k39_tab.idnk39_k39, dbo.k42_tab.idnk42_k42
FROM            dbo.k42_tab INNER JOIN
                         dbo.k39_tab ON dbo.k42_tab.idnk39_k42 = dbo.k39_tab.idnk39_k39







