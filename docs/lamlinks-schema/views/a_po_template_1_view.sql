-- dbo.a_po_template_1_view



/* view a_po_template_1_view: add view */


/* view a_po_template_1_view: add view */


/* view a_po_template_1_view: add view */

/* view a_po_template_1_view: add view */


/* view a_po_template_1_view: add view */
CREATE VIEW [dbo].[a_po_template_1_view]
AS
SELECT     dbo.kaq_tab.pofnam_kaq, dbo.kar_tab.areseq_kar, dbo.kas_tab.arowno_kas, dbo.kat_tab.rcolno_kat, dbo.kat_tab.exprsn_kat, dbo.kat_tab.poptyp_kat, 
                      dbo.kat_tab.popnam_kat, dbo.kat_tab.popval_kat, dbo.kar_tab.fhname_kar, dbo.kar_tab.fhstyl_kar, dbo.kar_tab.fdname_kar, dbo.kar_tab.fdstyl_kar, 
                      dbo.kas_tab.rowuse_kas, dbo.kas_tab.rowhen_kas
FROM         dbo.kaq_tab INNER JOIN
                      dbo.kar_tab ON dbo.kaq_tab.idnkaq_kaq = dbo.kar_tab.idnkaq_kar INNER JOIN
                      dbo.kas_tab ON dbo.kar_tab.idnkar_kar = dbo.kas_tab.idnkar_kas INNER JOIN
                      dbo.kat_tab ON dbo.kas_tab.idnkas_kas = dbo.kat_tab.idnkas_kat





