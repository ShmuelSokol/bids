-- dbo.document_set_list_3_view



/* view document_set_list_3_view: add view */


/* view document_set_list_3_view: add view */


/* view document_set_list_3_view: add view */

/* view document_set_list_3_view: add view */


/* view document_set_list_3_view: add view */


/* view document_set_list_3_view: add view */


/* view document_set_list_3_view: add view */


/* view document_set_list_3_view: add view */


/* view document_set_list_3_view: add view */


/* view document_set_list_3_view: add view */


/* view document_set_list_3_view: add view */


/* view document_set_list_3_view: add view */


/* view document_set_list_3_view: add view */


/* view document_set_list_3_view: add view */


/* view document_set_list_3_view: add view */


/* view document_set_list_3_view: add view */


/* view document_set_list_3_view: add view */


/* view document_set_list_3_view: add view */
CREATE VIEW [dbo].[document_set_list_3_view]
AS
SELECT DISTINCT 
                      dbo.document_set_list_2_view.dstnam_k75, dbo.document_set_list_2_view.dsrtbl_k75, dbo.document_set_list_2_view.idndsr_k75, 
                      dbo.document_set_list_2_view.dsrust_k75, dbo.document_set_list_2_view.dcltyp_k76, dbo.document_set_list_2_view.dclloc_k76, 
                      dbo.document_set_list_2_view.dclnam_k76, dbo.document_set_list_2_view.dclisc_k76, dbo.document_set_list_2_view.dcltbl_k76, 
                      dbo.document_set_list_2_view.idndcl_k76, dbo.document_set_list_2_view.filnam_k76, dbo.document_set_list_2_view.idnk75_k75, 
                      dbo.document_set_list_2_view.idnk76_k76, dbo.document_set_list_2_view.gx2tbl_kau, dbo.document_set_list_2_view.idngx2_kau, 
                      dbo.sol_part_0_query.idnk11_k11
FROM         dbo.document_set_list_2_view INNER JOIN
                      dbo.sol_part_0_query ON dbo.document_set_list_2_view.idngx2_kau = dbo.sol_part_0_query.idnkc4_kc4
WHERE     (dbo.document_set_list_2_view.gx2tbl_kau = 'kc4')


















