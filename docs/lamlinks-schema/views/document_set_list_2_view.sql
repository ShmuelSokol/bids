-- dbo.document_set_list_2_view



/* view document_set_list_2_view: add view */


/* view document_set_list_2_view: add view */


/* view document_set_list_2_view: add view */

/* view document_set_list_2_view: add view */


/* view document_set_list_2_view: add view */


/* view document_set_list_2_view: add view */


/* view document_set_list_2_view: add view */


/* view document_set_list_2_view: add view */


/* view document_set_list_2_view: add view */


/* view document_set_list_2_view: add view */


/* view document_set_list_2_view: add view */


/* view document_set_list_2_view: add view */


/* view document_set_list_2_view: add view */


/* view document_set_list_2_view: add view */


/* view document_set_list_2_view: add view */


/* view document_set_list_2_view: add view */


/* view document_set_list_2_view: add view */


/* view document_set_list_2_view: add view */
CREATE VIEW [dbo].[document_set_list_2_view]
AS
SELECT DISTINCT 
                      dbo.document_set_list_1_view.dstnam_k75, dbo.document_set_list_1_view.dsrtbl_k75, dbo.document_set_list_1_view.idndsr_k75, 
                      dbo.document_set_list_1_view.dsrust_k75, dbo.document_set_list_1_view.dcltyp_k76, dbo.document_set_list_1_view.dclloc_k76, 
                      dbo.document_set_list_1_view.dclnam_k76, dbo.document_set_list_1_view.dclisc_k76, dbo.document_set_list_1_view.dcltbl_k76, 
                      dbo.document_set_list_1_view.idndcl_k76, dbo.document_set_list_1_view.filnam_k76, dbo.document_set_list_1_view.idnk75_k75, 
                      dbo.document_set_list_1_view.idnk76_k76, dbo.kau_tab.gx2tbl_kau, dbo.kau_tab.idngx2_kau
FROM         dbo.kau_tab INNER JOIN
                      dbo.document_set_list_1_view ON dbo.kau_tab.gx2tbl_kau = dbo.document_set_list_1_view.dsrtbl_k75 AND 
                      dbo.kau_tab.idngx1_kau = dbo.document_set_list_1_view.idnk75_k75


















