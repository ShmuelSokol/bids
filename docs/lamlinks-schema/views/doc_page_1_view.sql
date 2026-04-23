-- dbo.doc_page_1_view



/* view doc_page_1_view: add view */


/* view doc_page_1_view: add view */


/* view doc_page_1_view: add view */

/* view doc_page_1_view: add view */


/* view doc_page_1_view: add view */


/* view doc_page_1_view: add view */


/* view doc_page_1_view: add view */


/* view doc_page_1_view: add view */


/* view doc_page_1_view: add view */


/* view doc_page_1_view: add view */


/* view doc_page_1_view: add view */


/* view doc_page_1_view: add view */


/* view doc_page_1_view: add view */


/* view doc_page_1_view: add view */


/* view doc_page_1_view: add view */


/* view doc_page_1_view: add view */


/* view doc_page_1_view: add view */


/* view doc_page_1_view: add view */
CREATE VIEW [dbo].[doc_page_1_view]
AS
SELECT     K16_tab.dwg_no_k16, K16_tab.docsrc_k16, K16_tab.ssdtyp_k16, K16_tab.d_cage_k16, K16_tab.docdte_k16, K16_tab.titled_k16, K16_tab.dwgrev_k16, 
                      K16_tab.revdte_k16, K16_tab.doctyp_k16, K16_tab.avstat_k16, K17_tab.frame_k17, K17_tab.sheet_k17, K17_tab.fillen_k17, K17_tab.filnam_k17, K16_tab.idnk16_k16, 
                      K17_tab.idnk17_k17, K19_tab.idnk19_k19
FROM         dbo.k16_tab AS K16_tab INNER JOIN
                      dbo.k19_tab AS K19_tab ON K16_tab.idnk16_k16 = K19_tab.idnk16_k19 INNER JOIN
                      dbo.k17_tab AS K17_tab ON K19_tab.idnk17_k19 = K17_tab.idnk17_k17


















