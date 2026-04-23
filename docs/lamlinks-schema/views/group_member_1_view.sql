-- dbo.group_member_1_view



/* view group_member_1_view: add view */


/* view group_member_1_view: add view */


/* view group_member_1_view: add view */

/* view group_member_1_view: add view */


/* view group_member_1_view: add view */


/* view group_member_1_view: add view */


/* view group_member_1_view: add view */


/* view group_member_1_view: add view */


/* view group_member_1_view: add view */


/* view group_member_1_view: add view */


/* view group_member_1_view: add view */


/* view group_member_1_view: add view */


/* view group_member_1_view: add view */


/* view group_member_1_view: add view */


/* view group_member_1_view: add view */
/* view group_member_1_view: add view 
 view group_member_1_view: add view 
 view group_member_1_view: add view */
CREATE VIEW [dbo].[group_member_1_view]
AS
SELECT        dbo.k14_tab.u_name_k14, dbo.k12_tab.e_name_k12, dbo.kap_tab.catitl_kap, dbo.kap_tab.catdes_kap, dbo.k14_tab.idnk14_k14, dbo.k12_tab.e_emal_k12
FROM            dbo.kap_tab INNER JOIN
                         dbo.k12_tab INNER JOIN
                         dbo.k14_tab ON dbo.k12_tab.idnk12_k12 = dbo.k14_tab.idnk12_k14 INNER JOIN
                         dbo.kau_tab ON dbo.k14_tab.idnk14_k14 = dbo.kau_tab.idngx1_kau ON dbo.kap_tab.idnkap_kap = dbo.kau_tab.idngx2_kau
WHERE        (dbo.kau_tab.gx1tbl_kau = 'k14') AND (dbo.kau_tab.gx2tbl_kau = 'kap') AND (dbo.kap_tab.catype_kap = 'Group Membership')















