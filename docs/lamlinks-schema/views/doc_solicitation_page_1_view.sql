-- dbo.doc_solicitation_page_1_view



/* view doc_solicitation_page_1_view: add view */


/* view doc_solicitation_page_1_view: add view */


/* view doc_solicitation_page_1_view: add view */

/* view doc_solicitation_page_1_view: add view */


/* view doc_solicitation_page_1_view: add view */


/* view doc_solicitation_page_1_view: add view */


/* view doc_solicitation_page_1_view: add view */


/* view doc_solicitation_page_1_view: add view */


/* view doc_solicitation_page_1_view: add view */


/* view doc_solicitation_page_1_view: add view */


/* view doc_solicitation_page_1_view: add view */


/* view doc_solicitation_page_1_view: add view */


/* view doc_solicitation_page_1_view: add view */


/* view doc_solicitation_page_1_view: add view */


/* view doc_solicitation_page_1_view: add view */


/* view doc_solicitation_page_1_view: add view */


/* view doc_solicitation_page_1_view: add view */


/* view doc_solicitation_page_1_view: add view */
CREATE VIEW [dbo].[doc_solicitation_page_1_view]
AS
SELECT     dbo.doc_page_2_view.dwg_no_k16, dbo.doc_page_2_view.docsrc_k16, dbo.doc_page_2_view.ssdtyp_k16, dbo.doc_page_2_view.d_cage_k16, 
                      dbo.doc_page_2_view.docdte_k16, dbo.doc_page_2_view.titled_k16, dbo.doc_page_2_view.dwgrev_k16, dbo.doc_page_2_view.revdte_k16, 
                      dbo.doc_page_2_view.doctyp_k16, dbo.doc_page_2_view.avstat_k16, dbo.doc_page_2_view.frame_k17, dbo.doc_page_2_view.sheet_k17, 
                      dbo.doc_page_2_view.fillen_k17, dbo.doc_page_2_view.filnam_k17, dbo.doc_page_2_view.idnk16_k16, dbo.doc_page_2_view.idnk17_k17, 
                      dbo.doc_page_2_view.idnk19_k19, dbo.doc_page_2_view.dgutyp_k18, dbo.doc_page_2_view.idndgu_k18, dbo.doc_page_2_view.ty_no_k18, 
                      dbo.sol_part_0_query.idnk08_k08, dbo.sol_part_0_query.idnk09_k09, dbo.sol_part_0_query.idnk10_k10, dbo.sol_part_0_query.idnk11_k11, 
                      dbo.sol_part_0_query.idnkc4_kc4, dbo.sol_part_0_query.idnkcg_kcg
FROM         dbo.doc_page_2_view INNER JOIN
                      dbo.sol_part_0_query ON dbo.doc_page_2_view.idndgu_k18 = dbo.sol_part_0_query.idnk11_k11
WHERE     (dbo.doc_page_2_view.dgutyp_k18 = 'k11')


















