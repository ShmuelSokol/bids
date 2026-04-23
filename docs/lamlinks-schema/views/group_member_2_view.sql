-- dbo.group_member_2_view



/* view group_member_2_view: add view */


/* view group_member_2_view: add view */


/* view group_member_2_view: add view */

/* view group_member_2_view: add view */


/* view group_member_2_view: add view */


/* view group_member_2_view: add view */


/* view group_member_2_view: add view */


/* view group_member_2_view: add view */


/* view group_member_2_view: add view */


/* view group_member_2_view: add view */


/* view group_member_2_view: add view */


/* view group_member_2_view: add view */


/* view group_member_2_view: add view */


/* view group_member_2_view: add view */


/* view group_member_2_view: add view */


/* view group_member_2_view: add view */


/* view group_member_2_view: add view */


/* view group_member_2_view: add view */
CREATE VIEW [dbo].[group_member_2_view]
AS
SELECT     dbo.group_member_1_view.u_name_k14, dbo.group_member_1_view.e_name_k12, dbo.group_member_1_view.catitl_kap, dbo.group_member_1_view.catdes_kap, 
                      dbo.group_member_1_view.idnk14_k14, dbo.kah_tab.a_note_kah
FROM         dbo.group_member_1_view INNER JOIN
                      dbo.kah_tab ON dbo.group_member_1_view.idnk14_k14 = dbo.kah_tab.idnanu_kah
WHERE     (dbo.kah_tab.anutbl_kah = 'k14') AND (dbo.kah_tab.anutyp_kah = 'Sally Credentials')


















