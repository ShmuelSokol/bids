-- dbo.sol_part_7_view



/* view sol_part_7_view: add view */


/* view sol_part_7_view: add view */


/* view sol_part_7_view: add view */

/* view sol_part_7_view: add view */


/* view sol_part_7_view: add view */


/* view sol_part_7_view: add view */
CREATE VIEW [dbo].[sol_part_7_view]
AS
SELECT        dbo.solicitation_identity_1_view.idnk11_k11, dbo.solicitation_identity_1_view.idnkc4_kc4, dbo.kcg_tab.prdqty_kcg, dbo.kcg_tab.fatqty_kcg, dbo.kcg_tab.optqty_kcg, dbo.kcg_tab.othqty_kcg, 
                         dbo.kcg_tab.idnkcg_kcg
FROM            dbo.solicitation_identity_1_view INNER JOIN
                         dbo.kcg_tab ON dbo.solicitation_identity_1_view.idnkc4_kc4 = dbo.kcg_tab.idnkc4_kcg






