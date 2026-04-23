-- dbo.relationship_1_view



/* view relationship_1_view: add view */


/* view relationship_1_view: add view */


/* view relationship_1_view: add view */

/* view relationship_1_view: add view */


/* view relationship_1_view: add view */


/* view relationship_1_view: add view */


/* view relationship_1_view: add view */
/* view relationship_1_view: add view 
 view relationship_1_view: add view 
 view relationship_1_view: add view 
 view relationship_1_view: add view 
 view relationship_1_view: add view 
 view relationship_1_view: add view 
 view relationship_1_view: add view 
 view relationship_1_view: add view 
 view relationship_1_view: add view 
 view relationship_1_view: add view 
 view relationship_1_view: add view */
CREATE VIEW [dbo].[relationship_1_view]
AS
SELECT        dbo.kau_tab.gx1tbl_kau, dbo.kau_tab.idngx1_kau, dbo.kau_tab.gx2tbl_kau, dbo.kau_tab.idngx2_kau, dbo.kap_tab.adddte_kap, dbo.kau_tab.idnkau_kau, dbo.kap_tab.catitl_kap, dbo.kap_tab.catype_kap, 
                         dbo.kap_tab.idnkap_kap
FROM            dbo.kau_tab LEFT OUTER JOIN
                         dbo.kap_tab ON dbo.kau_tab.idnkap_kau = dbo.kap_tab.idnkap_kap







