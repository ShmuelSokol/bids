-- dbo.doc_page_2_view



/* view doc_page_2_view: add view */


/* view doc_page_2_view: add view */


/* view doc_page_2_view: add view */

/* view doc_page_2_view: add view */


/* view doc_page_2_view: add view */


/* view doc_page_2_view: add view */


/* view doc_page_2_view: add view */


/* view doc_page_2_view: add view */


/* view doc_page_2_view: add view */


/* view doc_page_2_view: add view */


/* view doc_page_2_view: add view */


/* view doc_page_2_view: add view */


/* view doc_page_2_view: add view */


/* view doc_page_2_view: add view */


/* view doc_page_2_view: add view */


/* view doc_page_2_view: add view */


/* view doc_page_2_view: add view */


/* view doc_page_2_view: add view */
CREATE VIEW [dbo].[doc_page_2_view]
AS
SELECT     dbo.doc_page_1_view.*, dbo.k18_tab.dgutyp_k18, dbo.k18_tab.idndgu_k18, dbo.k18_tab.ty_no_k18
FROM         dbo.doc_page_1_view INNER JOIN
                      dbo.k18_tab ON dbo.doc_page_1_view.idnk16_k16 = dbo.k18_tab.idnk16_k18


















