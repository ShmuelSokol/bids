-- dbo.part_demand_control_1_view



/* view part_demand_control_1_view: add view */


/* view part_demand_control_1_view: add view */


/* view part_demand_control_1_view: add view */

/* view part_demand_control_1_view: add view */


/* view part_demand_control_1_view: add view */


/* view part_demand_control_1_view: add view */


/* view part_demand_control_1_view: add view */


/* view part_demand_control_1_view: add view */


/* view part_demand_control_1_view: add view */


/* view part_demand_control_1_view: add view */


/* view part_demand_control_1_view: add view */


/* view part_demand_control_1_view: add view */


/* view part_demand_control_1_view: add view */


/* view part_demand_control_1_view: add view */


/* view part_demand_control_1_view: add view */


/* view part_demand_control_1_view: add view */


/* view part_demand_control_1_view: add view */


/* view part_demand_control_1_view: add view */
CREATE VIEW [dbo].[part_demand_control_1_view]
AS
SELECT     dbo.k79_tab.cntrct_k79, dbo.part_2_view.fsc_k08, dbo.part_2_view.niin_k08, dbo.part_2_view.prtnum_k71, dbo.part_2_view.pn_rev_k71, 
                      dbo.part_2_view.p_desc_k71, dbo.part_2_view.e_code_mfg, dbo.part_2_view.idnk08_k08, dbo.part_2_view.idnk71_k71, dbo.k84_tab.idnk84_k84
FROM         dbo.k84_tab INNER JOIN
                      dbo.k79_tab ON dbo.k84_tab.idnk79_k84 = dbo.k79_tab.idnk79_k79 INNER JOIN
                      dbo.part_2_view ON dbo.k84_tab.idnk71_k84 = dbo.part_2_view.idnk71_k71


















