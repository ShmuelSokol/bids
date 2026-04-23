-- dbo.a_login_relationship_1_view



/* view a_login_relationship_1_view: add view */


/* view a_login_relationship_1_view: add view */


/* view a_login_relationship_1_view: add view */

/* view a_login_relationship_1_view: add view */


/* view a_login_relationship_1_view: add view */


/* view a_login_relationship_1_view: add view */


/* view a_login_relationship_1_view: add view */


/* view a_login_relationship_1_view: add view */


/* view a_login_relationship_1_view: add view */


/* view a_login_relationship_1_view: add view */
CREATE VIEW [dbo].[a_login_relationship_1_view]
AS
SELECT        dbo.k14_tab.u_name_k14, dbo.kap_tab.catype_kap, dbo.kap_tab.catitl_kap, dbo.kap_tab.catdes_kap, dbo.k14_tab.idnk14_k14
FROM            dbo.k14_tab INNER JOIN
                         dbo.kau_tab ON dbo.k14_tab.idnk14_k14 = dbo.kau_tab.idngx1_kau INNER JOIN
                         dbo.kap_tab ON dbo.kau_tab.idngx2_kau = dbo.kap_tab.idnkap_kap
WHERE        (dbo.kau_tab.gx1tbl_kau = 'k14') AND (dbo.kau_tab.gx2tbl_kau = 'kap')










