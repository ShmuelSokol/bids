-- dbo.document_set_list_1_view



/* view document_set_list_1_view: add view */


/* view document_set_list_1_view: add view */


/* view document_set_list_1_view: add view */

/* view document_set_list_1_view: add view */


/* view document_set_list_1_view: add view */


/* view document_set_list_1_view: add view */


/* view document_set_list_1_view: add view */


/* view document_set_list_1_view: add view */


/* view document_set_list_1_view: add view */


/* view document_set_list_1_view: add view */


/* view document_set_list_1_view: add view */


/* view document_set_list_1_view: add view */


/* view document_set_list_1_view: add view */


/* view document_set_list_1_view: add view */


/* view document_set_list_1_view: add view */


/* view document_set_list_1_view: add view */


/* view document_set_list_1_view: add view */


/* view document_set_list_1_view: add view */
CREATE VIEW [dbo].[document_set_list_1_view]
AS
SELECT     dbo.k75_tab.dstnam_k75, dbo.k75_tab.dsrtbl_k75, dbo.k75_tab.idndsr_k75, dbo.k75_tab.dsrust_k75, dbo.k76_tab.dcltyp_k76, dbo.k76_tab.dclloc_k76, 
                      dbo.k76_tab.dclnam_k76, dbo.k76_tab.dclisc_k76, dbo.k76_tab.dcltbl_k76, dbo.k76_tab.idndcl_k76, dbo.k76_tab.filnam_k76, dbo.k75_tab.idnk75_k75, 
                      dbo.k76_tab.idnk76_k76
FROM         dbo.k76_tab INNER JOIN
                      dbo.k75_tab ON dbo.k76_tab.idnk75_k76 = dbo.k75_tab.idnk75_k75


















